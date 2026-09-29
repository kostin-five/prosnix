import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

import type { BillingRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";
import type { BillingService } from "./service.js";
import type {
  FollowUpCallback,
  FollowUpCallbackHandler,
} from "../notifications/follow-up-callback.js";

function sameSecret(actual: string | undefined, expected: string): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

interface TelegramUpdate {
  update_id?: number;
  callback_query?: FollowUpCallback;
  subscription?: {
    user?: { id?: number };
    invoice_payload?: string;
    state?: "active" | "canceled" | "failed";
  };
  pre_checkout_query?: {
    id?: string;
    from?: { id?: number };
    currency?: string;
    total_amount?: number;
    invoice_payload?: string;
  };
  message?: {
    from?: { id?: number };
    chat?: { id?: number };
    text?: string;
    successful_payment?: {
      currency?: string;
      total_amount?: number;
      invoice_payload?: string;
      telegram_payment_charge_id?: string;
      subscription_expiration_date?: number;
      is_recurring?: true;
      is_first_recurring?: true;
    };
  };
}

export async function registerBillingRoutes(
  app: FastifyInstance,
  options: {
    config: AppConfig;
    service: BillingService;
    repository: BillingRepository;
    followUpCallback?: FollowUpCallbackHandler;
    now?: () => Date;
  },
): Promise<void> {
  app.get("/api/v1/billing/status", async (request, reply) => {
    const userId = authenticatedUserId(request, options.config, options.now?.() ?? new Date());
    if (!userId) return reply.status(401).send({ error: "authentication_required" });
    return options.service.status(userId);
  });

  app.post(
    "/api/v1/billing/checkout",
    { config: { rateLimit: { max: options.config.billingRateLimitMax, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const userId = authenticatedUserId(request, options.config, options.now?.() ?? new Date());
      if (!userId) return reply.status(401).send({ error: "authentication_required" });
      try {
        return await options.service.checkout(userId);
      } catch (error) {
        const code = error instanceof Error ? error.message : "checkout_failed";
        if (code === "billing_disabled" || code === "legal_acceptance_required") {
          return reply.status(409).send({ error: code });
        }
        request.log.warn(
          { event: "billing_checkout_failed", requestId: request.id },
          "checkout failed",
        );
        return reply.status(503).send({ error: "checkout_unavailable" });
      }
    },
  );

  app.post("/internal/telegram/webhook", async (request, reply) => {
    if (
      !sameSecret(
        request.headers["x-telegram-bot-api-secret-token"] as string | undefined,
        options.config.telegramWebhookSecret,
      )
    ) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const update = request.body as TelegramUpdate;
    if (update.callback_query) {
      try {
        await options.followUpCallback?.handle(update.callback_query);
      } catch {
        return reply.status(503).send({ error: "callback_unavailable" });
      }
      return { ok: true };
    }
    const messageText = update.message?.text?.trim() ?? "";
    const command = messageText.split(/\s+/, 1)[0]?.split("@", 1)[0];
    const messageChatId = update.message?.chat?.id;
    if (command === "/paysupport" && Number.isSafeInteger(messageChatId)) {
      const separator = messageText.search(/\s/);
      const message =
        separator < 0
          ? ""
          : messageText
              .slice(separator + 1)
              .trim()
              .slice(0, 1_000);
      await options.service.paySupport(BigInt(messageChatId!), message);
      return { ok: true };
    }
    if ((command === "/terms" || command === "/privacy") && Number.isSafeInteger(messageChatId)) {
      await options.service.legalLinks(BigInt(messageChatId!));
      return { ok: true };
    }
    const pre = update.pre_checkout_query;
    if (
      pre?.id &&
      Number.isSafeInteger(pre.from?.id) &&
      pre.currency &&
      Number.isSafeInteger(pre.total_amount) &&
      pre.invoice_payload
    ) {
      await options.service.preCheckout({
        queryId: pre.id,
        checkoutId: pre.invoice_payload,
        telegramUserId: BigInt(pre.from!.id!),
        currency: pre.currency,
        totalAmount: pre.total_amount!,
      });
      return { ok: true };
    }
    const payment = update.message?.successful_payment;
    if (
      Number.isSafeInteger(update.update_id) &&
      Number.isSafeInteger(update.message?.from?.id) &&
      payment?.currency &&
      Number.isSafeInteger(payment.total_amount) &&
      payment.invoice_payload &&
      payment.telegram_payment_charge_id &&
      Number.isSafeInteger(payment.subscription_expiration_date)
    ) {
      const result = await options.repository.activate({
        updateId: BigInt(update.update_id!),
        checkoutId: payment.invoice_payload,
        telegramUserId: BigInt(update.message!.from!.id!),
        currency: payment.currency,
        totalAmount: payment.total_amount!,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        currentPeriodEnd: new Date(payment.subscription_expiration_date! * 1000),
        paidAt: options.now?.() ?? new Date(),
        isRecurring: payment.is_recurring === true,
        isFirstRecurring: payment.is_first_recurring === true,
      });
      if (result === "rejected") {
        request.log.warn({ event: "payment_rejected", requestId: request.id }, "payment rejected");
      }
      return { ok: true };
    }
    const subscription = update.subscription;
    if (
      Number.isSafeInteger(update.update_id) &&
      Number.isSafeInteger(subscription?.user?.id) &&
      subscription?.invoice_payload &&
      subscription.state
    ) {
      const result = await options.repository.updateSubscriptionState({
        updateId: BigInt(update.update_id!),
        checkoutId: subscription.invoice_payload,
        telegramUserId: BigInt(subscription.user!.id!),
        state: subscription.state === "failed" ? "past_due" : subscription.state,
        observedAt: options.now?.() ?? new Date(),
      });
      if (result === "rejected") {
        request.log.warn(
          { event: "subscription_update_rejected", requestId: request.id },
          "subscription update rejected",
        );
      }
    }
    return { ok: true };
  });
}
