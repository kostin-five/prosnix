import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  experimentAssignments,
  followUpObservations,
  PostgresFollowUpNotificationRepository,
  PostgresUserDeletionRepository,
  protocolDefinitions,
  wakeSessions,
} from "@awc/db";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)("follow-up notification concurrency", () => {
  const database = connectDatabase(databaseUrl!);

  afterAll(async () => database.close());

  it("claims a due session once and skips answered or stale sessions", async () => {
    const telegramUserId = 910000000100n;
    const deletion = new PostgresUserDeletionRepository(database.db);
    const existing = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    await deletion.deleteUser(existing.id, "follow-up-cleanup-before");
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );

    await database.db
      .insert(protocolDefinitions)
      .values({
        protocolKey: "follow-up-notification-integration",
        version: 1,
        title: "Integration protocol",
        steps: [],
      })
      .onConflictDoNothing();
    const protocol = await database.db.query.protocolDefinitions.findFirst({
      columns: { id: true },
      where: (table, { eq }) => eq(table.protocolKey, "follow-up-notification-integration"),
    });
    expect(protocol).toBeDefined();

    async function completedSession(dueAt: Date) {
      const [assignment] = await database.db
        .insert(experimentAssignments)
        .values({
          userId: user.id,
          protocolDefinitionId: protocol!.id,
          strategyVersion: "integration-v1",
          phase: "fallback",
          hypothesis: "Проверка доставки follow-up",
        })
        .returning({ id: experimentAssignments.id });
      const [session] = await database.db
        .insert(wakeSessions)
        .values({
          userId: user.id,
          assignmentId: assignment!.id,
          status: "protocol_completed",
          protocolCompletedAt: new Date(dueAt.getTime() - 15 * 60_000),
          followUpDueAt: dueAt,
        })
        .returning({ id: wakeSessions.id });
      return session!;
    }

    const now = new Date("2026-08-30T06:20:00.000Z");
    const due = await completedSession(new Date("2026-08-30T06:19:00.000Z"));
    const first = new PostgresFollowUpNotificationRepository(database.db);
    const second = new PostgresFollowUpNotificationRepository(database.db);
    const batches = await Promise.all([first.claimDue(now, 10), second.claimDue(now, 10)]);
    const claims = batches.flatMap((batch) => batch.notifications);
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ sessionId: due.id, telegramChatId: telegramUserId });
    expect(await first.prepareToSend(claims[0]!.deliveryId, now)).toBe(true);
    await first.complete(
      claims[0]!.deliveryId,
      { status: "sent", telegramMessageId: 456n, sentAt: now },
      now,
    );

    const answered = await completedSession(new Date("2026-08-30T06:19:30.000Z"));
    await database.db.insert(followUpObservations).values({
      userId: user.id,
      sessionId: answered.id,
      outcome: "up",
      observedAt: now,
      minutesAfterCompletion: 15,
      operationId: "follow-up-integration-answer",
    });
    await completedSession(new Date("2026-08-30T04:00:00.000Z"));

    const finalBatch = await first.claimDue(now, 10);
    expect(finalBatch.notifications).toHaveLength(0);
    expect(finalBatch.skipped).toBe(1);
    expect(finalBatch.maxLagMs).toBe(140 * 60_000);
    await deletion.deleteUser(user.id, "follow-up-cleanup-after");
  });
});
