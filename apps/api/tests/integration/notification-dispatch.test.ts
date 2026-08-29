import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresUserDeletionRepository,
  PostgresWakeNotificationRepository,
  PostgresWakeScheduleRepository,
} from "@awc/db";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)("notification delivery concurrency", () => {
  const database = connectDatabase(databaseUrl!);

  afterAll(async () => database.close());

  it("claims one due occurrence only once across parallel workers", async () => {
    const telegramUserId = 910000000099n;
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    const deletion = new PostgresUserDeletionRepository(database.db);
    await deletion.deleteUser(user.id, "notification-cleanup-before");
    const freshUser = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    const dueAt = new Date("2026-08-29T04:00:00Z");
    const now = new Date("2026-08-29T04:01:00Z");
    const schedules = new PostgresWakeScheduleRepository(database.db);
    await schedules.save({
      userId: freshUser.id,
      localTime: "07:00",
      timezone: "Europe/Moscow",
      enabled: true,
      nextTriggerAt: dueAt,
      now: new Date("2026-08-28T12:00:00Z"),
    });

    const first = new PostgresWakeNotificationRepository(database.db);
    const second = new PostgresWakeNotificationRepository(database.db);
    const claims = (await Promise.all([first.claimDue(now, 10), second.claimDue(now, 10)])).flat();
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ telegramChatId: telegramUserId, scheduledFor: dueAt });

    await first.complete(
      claims[0]!.deliveryId,
      { status: "sent", telegramMessageId: 123n, sentAt: now },
      now,
    );
    expect(await schedules.findByUserId(freshUser.id)).toMatchObject({
      enabled: true,
      botStatus: "available",
      nextTriggerAt: new Date("2026-08-30T04:00:00Z"),
    });
    expect(await first.claimDue(now, 10)).toHaveLength(0);
    await deletion.deleteUser(freshUser.id, "notification-cleanup-after");
  });
});
