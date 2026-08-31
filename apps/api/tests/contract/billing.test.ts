import { describe, expect, it } from "vitest";

import type {
  BillingCheckoutRecord,
  BillingRepository,
  LegalAcceptanceRecord,
  SubscriptionRecord,
} from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import type { TelegramStarsGateway } from "../../src/billing/telegram-stars.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

function billingMemory(
  userId: string,
  subscription: SubscriptionRecord | null = null,
): BillingRepository {
  let checkout: BillingCheckoutRecord | null = null;
  return {
    findSubscription: async () => subscription,
    createCheckout: async (input) =>
      (checkout = {
        id: "00000000-0000-4000-8000-000000000777",
        ...input,
        status: "pending",
        invoiceUrl: null,
      }),
    setInvoiceUrl: async (_id, invoiceUrl) => {
      if (checkout) checkout.invoiceUrl = invoiceUrl;
    },
    findCheckout: async () => checkout,
    checkoutBelongsToTelegramUser: async () => true,
    activate: async () => "activated",
    updateSubscriptionState: async () => "updated",
  };
}

const telegram: TelegramStarsGateway = {
  createMonthlyInvoice: async () => "https://t.me/$test-invoice",
  answerPreCheckout: async () => undefined,
  sendPaySupport: async () => undefined,
  sendLegalLinks: async () => undefined,
};

describe("billing contract", () => {
  it("keeps sales disabled by default and rejects an untrusted webhook", async () => {
    const dependencies = createMemoryDependencies();
    const legalRecord: LegalAcceptanceRecord = {
      privacyVersion: testConfig.legalPrivacyVersion,
      termsVersion: testConfig.legalTermsVersion,
      acceptedAt: testNow,
    };
    const app = await createApp(testConfig, {
      ...dependencies,
      billingRepository: billingMemory(dependencies.user.id),
      legalAcceptanceRepository: { find: async () => legalRecord, accept: async () => undefined },
      telegramStarsGateway: telegram,
      now: () => testNow,
    });
    const cookie = await authenticateTestUser(app);
    expect(
      (await app.inject({ url: "/api/v1/billing/status", headers: { cookie } })).json(),
    ).toMatchObject({ enabled: false, entitlement: { status: "free" } });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/billing/checkout",
          headers: { cookie },
          payload: {},
        })
      ).json(),
    ).toEqual({ error: "billing_disabled" });
    expect(
      (await app.inject({ method: "POST", url: "/internal/telegram/webhook", payload: {} }))
        .statusCode,
    ).toBe(401);
    await app.close();
  });

  it("creates a personal invoice only after legal acceptance", async () => {
    const dependencies = createMemoryDependencies();
    let legal: LegalAcceptanceRecord | null = null;
    const config = { ...testConfig, telegramStarsMonthlyPrice: 149 };
    const app = await createApp(config, {
      ...dependencies,
      billingRepository: billingMemory(dependencies.user.id),
      legalAcceptanceRepository: { find: async () => legal, accept: async () => undefined },
      telegramStarsGateway: telegram,
      now: () => testNow,
    });
    const cookie = await authenticateTestUser(app);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/billing/checkout",
          headers: { cookie },
          payload: {},
        })
      ).statusCode,
    ).toBe(409);
    legal = {
      privacyVersion: config.legalPrivacyVersion,
      termsVersion: config.legalTermsVersion,
      acceptedAt: testNow,
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/billing/checkout",
          headers: { cookie },
          payload: {},
        })
      ).json(),
    ).toEqual({ invoiceUrl: "https://t.me/$test-invoice", expiresAt: "2026-08-27T06:15:00.000Z" });
    await app.close();
  });

  it("handles legal and payment-support commands through the protected webhook", async () => {
    const dependencies = createMemoryDependencies();
    const calls: string[] = [];
    const commandGateway: TelegramStarsGateway = {
      ...telegram,
      sendPaySupport: async ({ message }) => {
        calls.push(`support:${message}`);
      },
      sendLegalLinks: async () => {
        calls.push("legal");
      },
    };
    const app = await createApp(testConfig, {
      ...dependencies,
      billingRepository: billingMemory(dependencies.user.id),
      legalAcceptanceRepository: { find: async () => null, accept: async () => undefined },
      telegramStarsGateway: commandGateway,
      now: () => testNow,
    });
    const headers = {
      "x-telegram-bot-api-secret-token": testConfig.telegramWebhookSecret,
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/internal/telegram/webhook",
          headers,
          payload: { message: { chat: { id: 42 }, text: "/terms" } },
        })
      ).statusCode,
    ).toBe(200);
    await app.inject({
      method: "POST",
      url: "/internal/telegram/webhook",
      headers,
      payload: { message: { chat: { id: 42 }, text: "/paysupport списание повторилось" } },
    });
    expect(calls).toEqual(["legal", "support:списание повторилось"]);
    await app.close();
  });

  it("keeps canceled access until its paid period ends", async () => {
    const dependencies = createMemoryDependencies();
    const currentPeriodEnd = new Date(testNow.getTime() + 86_400_000);
    const app = await createApp(testConfig, {
      ...dependencies,
      billingRepository: billingMemory(dependencies.user.id, {
        status: "canceled",
        currentPeriodEnd,
      }),
      legalAcceptanceRepository: { find: async () => null, accept: async () => undefined },
      telegramStarsGateway: telegram,
      now: () => testNow,
    });
    const cookie = await authenticateTestUser(app);
    expect(
      (await app.inject({ url: "/api/v1/billing/status", headers: { cookie } })).json(),
    ).toMatchObject({
      entitlement: { status: "canceled", currentPeriodEnd: currentPeriodEnd.toISOString() },
    });
    await app.close();
  });
});
