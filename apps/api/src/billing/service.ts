import type { BillingRepository, LegalAcceptanceRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import type { TelegramStarsGateway } from "./telegram-stars.js";

export class BillingService {
  static readonly planKey: "pro-monthly-v1" = "pro-monthly-v1";

  constructor(
    private readonly config: AppConfig,
    private readonly billing: BillingRepository,
    private readonly legal: LegalAcceptanceRepository,
    private readonly telegram: TelegramStarsGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async status(userId: string) {
    const now = this.now();
    const subscription = await this.billing.findSubscription(userId);
    const periodCurrent = Boolean(subscription && subscription.currentPeriodEnd > now);
    const entitled =
      periodCurrent &&
      (subscription?.status === "active" ||
        subscription?.status === "canceled" ||
        subscription?.status === "past_due");
    const status = !subscription
      ? ("free" as const)
      : entitled
        ? subscription.status
        : subscription.status === "active" ||
            subscription.status === "canceled" ||
            subscription.status === "past_due"
          ? ("expired" as const)
          : subscription.status;
    return {
      enabled: this.config.telegramStarsMonthlyPrice > 0,
      plan: {
        key: BillingService.planKey,
        priceStars:
          this.config.telegramStarsMonthlyPrice > 0 ? this.config.telegramStarsMonthlyPrice : null,
        periodDays: 30 as const,
      },
      entitlement: {
        status,
        currentPeriodEnd: subscription?.currentPeriodEnd.toISOString() ?? null,
      },
    };
  }

  async checkout(userId: string) {
    if (this.config.telegramStarsMonthlyPrice <= 0) throw new Error("billing_disabled");
    const accepted = await this.legal.find(userId);
    if (
      accepted?.privacyVersion !== this.config.legalPrivacyVersion ||
      accepted.termsVersion !== this.config.legalTermsVersion
    ) {
      throw new Error("legal_acceptance_required");
    }
    const now = this.now();
    const record = await this.billing.createCheckout({
      userId,
      planKey: BillingService.planKey,
      priceStars: this.config.telegramStarsMonthlyPrice,
      expiresAt: new Date(now.getTime() + 15 * 60_000),
    });
    const invoiceUrl = await this.telegram.createMonthlyInvoice({
      checkoutId: record.id,
      priceStars: record.priceStars,
    });
    await this.billing.setInvoiceUrl(record.id, invoiceUrl);
    return { invoiceUrl, expiresAt: record.expiresAt.toISOString() };
  }

  async preCheckout(input: {
    queryId: string;
    checkoutId: string;
    telegramUserId: bigint;
    currency: string;
    totalAmount: number;
  }): Promise<void> {
    const record = await this.billing.findCheckout(input.checkoutId);
    const validOwner = await this.billing.checkoutBelongsToTelegramUser(
      input.checkoutId,
      input.telegramUserId,
    );
    const valid =
      Boolean(record) &&
      validOwner &&
      record!.status === "pending" &&
      record!.expiresAt > this.now() &&
      input.currency === "XTR" &&
      input.totalAmount === record!.priceStars;
    await this.telegram.answerPreCheckout({
      queryId: input.queryId,
      ok: valid,
      ...(!valid ? { errorMessage: "Счёт устарел или не принадлежит этому пользователю." } : {}),
    });
  }

  async paySupport(chatId: bigint, message: string): Promise<void> {
    await this.telegram.sendPaySupport({
      chatId,
      message,
      adminTelegramUserIds: this.config.adminTelegramUserIds,
    });
  }

  async legalLinks(chatId: bigint): Promise<void> {
    await this.telegram.sendLegalLinks(chatId, this.config.telegramWebAppUrl);
  }
}
