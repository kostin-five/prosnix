import { and, eq } from "drizzle-orm";

import type { BillingRepository } from "@awc/domain";
import {
  billingCheckouts,
  subscriptions,
  telegramPaymentUpdates,
  telegramStarPayments,
  users,
} from "../schema.js";
import type { Database } from "./types.js";

function checkout(row: typeof billingCheckouts.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    planKey: row.planKey,
    priceStars: row.priceStars,
    status: row.status,
    invoiceUrl: row.invoiceUrl,
    expiresAt: row.expiresAt,
  };
}

export class PostgresBillingRepository implements BillingRepository {
  constructor(private readonly db: Database) {}

  async findSubscription(userId: string) {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return row ? { status: row.status, currentPeriodEnd: row.currentPeriodEnd } : null;
  }

  async createCheckout(input: Parameters<BillingRepository["createCheckout"]>[0]) {
    const [row] = await this.db.insert(billingCheckouts).values(input).returning();
    if (!row) throw new Error("Checkout insert did not return a row");
    return checkout(row);
  }

  async setInvoiceUrl(checkoutId: string, invoiceUrl: string): Promise<void> {
    await this.db
      .update(billingCheckouts)
      .set({ invoiceUrl })
      .where(eq(billingCheckouts.id, checkoutId));
  }

  async findCheckout(checkoutId: string) {
    const [row] = await this.db
      .select()
      .from(billingCheckouts)
      .where(eq(billingCheckouts.id, checkoutId))
      .limit(1);
    return row ? checkout(row) : null;
  }

  async checkoutBelongsToTelegramUser(checkoutId: string, telegramUserId: bigint) {
    const [row] = await this.db
      .select({ id: billingCheckouts.id })
      .from(billingCheckouts)
      .innerJoin(users, eq(users.id, billingCheckouts.userId))
      .where(and(eq(billingCheckouts.id, checkoutId), eq(users.telegramUserId, telegramUserId)))
      .limit(1);
    return Boolean(row);
  }

  async activate(input: Parameters<BillingRepository["activate"]>[0]) {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(telegramPaymentUpdates)
        .values({
          updateId: input.updateId,
          eventType: "successful_payment",
          processedAt: input.paidAt,
        })
        .onConflictDoNothing()
        .returning({ updateId: telegramPaymentUpdates.updateId });
      if (inserted.length === 0) return "duplicate" as const;

      const [owned] = await tx
        .select({ checkout: billingCheckouts, telegramUserId: users.telegramUserId })
        .from(billingCheckouts)
        .innerJoin(users, eq(users.id, billingCheckouts.userId))
        .where(
          and(
            eq(billingCheckouts.id, input.checkoutId),
            eq(users.telegramUserId, input.telegramUserId),
          ),
        )
        .limit(1);
      if (!owned || input.currency !== "XTR" || owned.checkout.priceStars !== input.totalAmount) {
        return "rejected" as const;
      }
      const validFirstPayment =
        owned.checkout.status === "pending" && owned.checkout.expiresAt > input.paidAt;
      const validRenewal =
        input.isRecurring && !input.isFirstRecurring && owned.checkout.status === "paid";
      if (!validFirstPayment && !validRenewal) return "rejected" as const;

      const [existingCharge] = await tx
        .select({ userId: telegramStarPayments.userId })
        .from(telegramStarPayments)
        .where(eq(telegramStarPayments.telegramPaymentChargeId, input.telegramPaymentChargeId))
        .limit(1);
      if (existingCharge) return "duplicate" as const;

      await tx.insert(telegramStarPayments).values({
        telegramPaymentChargeId: input.telegramPaymentChargeId,
        updateId: input.updateId,
        checkoutId: input.checkoutId,
        userId: owned.checkout.userId,
        amountStars: input.totalAmount,
        paidAt: input.paidAt,
        periodEnd: input.currentPeriodEnd,
        isRecurring: input.isRecurring,
      });

      if (validFirstPayment) {
        await tx
          .update(billingCheckouts)
          .set({ status: "paid", paidAt: input.paidAt })
          .where(eq(billingCheckouts.id, input.checkoutId));
      }
      await tx
        .insert(subscriptions)
        .values({
          userId: owned.checkout.userId,
          planKey: owned.checkout.planKey,
          status: "active",
          priceStars: owned.checkout.priceStars,
          telegramPaymentChargeId: input.telegramPaymentChargeId,
          currentPeriodEnd: input.currentPeriodEnd,
          createdAt: input.paidAt,
          updatedAt: input.paidAt,
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: {
            planKey: owned.checkout.planKey,
            status: "active",
            priceStars: owned.checkout.priceStars,
            currentPeriodEnd: input.currentPeriodEnd,
            updatedAt: input.paidAt,
          },
        });
      return "activated" as const;
    });
  }

  async updateSubscriptionState(
    input: Parameters<BillingRepository["updateSubscriptionState"]>[0],
  ) {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(telegramPaymentUpdates)
        .values({
          updateId: input.updateId,
          eventType: `subscription_${input.state}`,
          processedAt: input.observedAt,
        })
        .onConflictDoNothing()
        .returning({ updateId: telegramPaymentUpdates.updateId });
      if (inserted.length === 0) return "duplicate" as const;

      const [owned] = await tx
        .select({ userId: billingCheckouts.userId })
        .from(billingCheckouts)
        .innerJoin(users, eq(users.id, billingCheckouts.userId))
        .where(
          and(
            eq(billingCheckouts.id, input.checkoutId),
            eq(users.telegramUserId, input.telegramUserId),
          ),
        )
        .limit(1);
      if (!owned) return "rejected" as const;
      const changed = await tx
        .update(subscriptions)
        .set({ status: input.state, updatedAt: input.observedAt })
        .where(eq(subscriptions.userId, owned.userId))
        .returning({ userId: subscriptions.userId });
      return changed.length === 1 ? ("updated" as const) : ("rejected" as const);
    });
  }
}
