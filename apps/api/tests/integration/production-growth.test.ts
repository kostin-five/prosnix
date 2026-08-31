import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresAdminGrowthRepository,
  PostgresBillingRepository,
  PostgresLegalAcceptanceRepository,
  PostgresUserDeletionRepository,
} from "@awc/db";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;
const telegramUserId = 910000000031n;

describe.runIf(Boolean(databaseUrl) && localDatabase)("PostgreSQL production growth", () => {
  const connections: Array<ReturnType<typeof connectDatabase>> = [];

  function connect() {
    const connection = connectDatabase(databaseUrl!);
    connections.push(connection);
    return connection;
  }

  afterAll(async () => {
    await Promise.all(connections.map((connection) => connection.close()));
  });

  it("сохраняет legal acceptance, защищает admin и удаляет legal-данные с профилем", async () => {
    const database = connect();
    const existing = await database.unitOfWork.transaction(({ users }) =>
      users.findByTelegramId(telegramUserId),
    );
    if (existing) {
      await new PostgresUserDeletionRepository(database.db).deleteUser(
        existing.id,
        "production-growth-cleanup-before-legal",
      );
    }
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    const legal = new PostgresLegalAcceptanceRepository(database.db);
    const acceptedAt = new Date("2026-08-31T09:00:00.000Z");
    await legal.accept({
      userId: user.id,
      privacyVersion: "2026-08-31",
      termsVersion: "2026-08-31",
      acceptedAt,
    });
    expect(await legal.find(user.id)).toEqual({
      privacyVersion: "2026-08-31",
      termsVersion: "2026-08-31",
      acceptedAt,
    });

    const admin = new PostgresAdminGrowthRepository(database.db);
    await expect(admin.isAllowed(user.id, [])).resolves.toBe(false);
    await expect(admin.isAllowed(user.id, [telegramUserId])).resolves.toBe(true);
    const summary = await admin.summarize(
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-09-01T00:00:00.000Z"),
    );
    expect(summary.users.total).toBeGreaterThanOrEqual(1);
    expect(summary).not.toHaveProperty("telegramUserId");

    await new PostgresUserDeletionRepository(database.db).deleteUser(
      user.id,
      "production-growth-cleanup-after-legal",
    );
    await expect(legal.find(user.id)).resolves.toBeNull();
  });

  it("активирует Telegram Stars подписку строго один раз", async () => {
    const database = connect();
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    const billing = new PostgresBillingRepository(database.db);
    const paidAt = new Date("2026-08-31T09:10:00.000Z");
    const periodEnd = new Date("2026-09-30T09:10:00.000Z");
    const updateId = BigInt(Date.now());
    const checkout = await billing.createCheckout({
      userId: user.id,
      planKey: "pro-monthly-v1",
      priceStars: 199,
      expiresAt: new Date("2026-08-31T09:20:00.000Z"),
    });
    await expect(
      billing.activate({
        updateId,
        checkoutId: checkout.id,
        telegramUserId,
        currency: "XTR",
        totalAmount: 199,
        telegramPaymentChargeId: "production-growth-charge-1",
        currentPeriodEnd: periodEnd,
        paidAt,
        isRecurring: true,
        isFirstRecurring: true,
      }),
    ).resolves.toBe("activated");
    await expect(
      billing.activate({
        updateId,
        checkoutId: checkout.id,
        telegramUserId,
        currency: "XTR",
        totalAmount: 199,
        telegramPaymentChargeId: "production-growth-charge-1",
        currentPeriodEnd: periodEnd,
        paidAt,
        isRecurring: true,
        isFirstRecurring: true,
      }),
    ).resolves.toBe("duplicate");
    const renewedPeriodEnd = new Date("2026-10-30T09:10:00.000Z");
    await expect(
      billing.activate({
        updateId: updateId + 1n,
        checkoutId: checkout.id,
        telegramUserId,
        currency: "XTR",
        totalAmount: 199,
        telegramPaymentChargeId: "production-growth-charge-2",
        currentPeriodEnd: renewedPeriodEnd,
        paidAt: new Date("2026-09-30T09:10:00.000Z"),
        isRecurring: true,
        isFirstRecurring: false,
      }),
    ).resolves.toBe("activated");
    await expect(billing.findSubscription(user.id)).resolves.toEqual({
      status: "active",
      currentPeriodEnd: renewedPeriodEnd,
    });
    await expect(
      billing.updateSubscriptionState({
        updateId: updateId + 2n,
        checkoutId: checkout.id,
        telegramUserId,
        state: "canceled",
        observedAt: new Date("2026-09-30T09:11:00.000Z"),
      }),
    ).resolves.toBe("updated");
    await expect(billing.findSubscription(user.id)).resolves.toEqual({
      status: "canceled",
      currentPeriodEnd: renewedPeriodEnd,
    });

    const summary = await new PostgresAdminGrowthRepository(database.db).summarize(
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-10-01T00:00:00.000Z"),
    );
    expect(summary.billing.activeSubscriptions).toBeGreaterThanOrEqual(1);
    expect(summary.billing.grossStars).toBeGreaterThanOrEqual(398);

    await new PostgresUserDeletionRepository(database.db).deleteUser(
      user.id,
      "production-growth-cleanup-after-billing",
    );
    await expect(billing.findSubscription(user.id)).resolves.toBeNull();
  });
});
