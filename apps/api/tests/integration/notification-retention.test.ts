import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  experimentAssignments,
  followUpNotificationDeliveries,
  followUpObservations,
  notificationDeliveries,
  PostgresNotificationMaintenanceRepository,
  PostgresUserDeletionRepository,
  PostgresWakeScheduleRepository,
  protocolDefinitions,
  wakeSessions,
} from "@awc/db";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)("notification retention", () => {
  const database = connectDatabase(databaseUrl!);

  afterAll(async () => database.close());

  it("deletes only delivery logs older than 90 days", async () => {
    const telegramUserId = 910000000101n;
    const deletion = new PostgresUserDeletionRepository(database.db);
    const existing = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    await deletion.deleteUser(existing.id, "retention-cleanup-before");
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    const schedules = new PostgresWakeScheduleRepository(database.db);
    await schedules.save({
      userId: user.id,
      localTime: "07:00",
      timezone: "Europe/Moscow",
      enabled: true,
      nextTriggerAt: new Date("2026-09-01T04:00:00.000Z"),
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    await database.db
      .insert(protocolDefinitions)
      .values({
        protocolKey: "notification-retention-integration",
        version: 1,
        title: "Retention protocol",
        steps: [],
      })
      .onConflictDoNothing();
    const protocol = await database.db.query.protocolDefinitions.findFirst({
      columns: { id: true },
      where: (table, { eq }) => eq(table.protocolKey, "notification-retention-integration"),
    });

    async function completedSession(suffix: string) {
      const [assignment] = await database.db
        .insert(experimentAssignments)
        .values({
          userId: user.id,
          protocolDefinitionId: protocol!.id,
          strategyVersion: `retention-${suffix}`,
          phase: "fallback",
          hypothesis: "Проверка срока хранения",
        })
        .returning({ id: experimentAssignments.id });
      const [session] = await database.db
        .insert(wakeSessions)
        .values({
          userId: user.id,
          assignmentId: assignment!.id,
          status: "protocol_completed",
          protocolCompletedAt: new Date("2027-04-30T23:45:00.000Z"),
          followUpDueAt: new Date("2027-05-01T00:00:00.000Z"),
        })
        .returning({ id: wakeSessions.id });
      return session!;
    }

    const oldSession = await completedSession("old");
    const freshSession = await completedSession("fresh");
    const cutoff = new Date("2026-06-01T00:00:00.000Z");
    const oldCreatedAt = new Date("2026-05-31T23:59:59.000Z");
    await database.db.insert(notificationDeliveries).values([
      {
        scheduleUserId: user.id,
        scheduledFor: new Date("2026-05-01T04:00:00.000Z"),
        status: "sent",
        createdAt: oldCreatedAt,
        updatedAt: oldCreatedAt,
      },
      {
        scheduleUserId: user.id,
        scheduledFor: new Date("2026-06-01T04:00:00.000Z"),
        status: "sent",
        createdAt: cutoff,
        updatedAt: cutoff,
      },
    ]);
    await database.db.insert(followUpNotificationDeliveries).values([
      {
        sessionId: oldSession.id,
        userId: user.id,
        scheduledFor: new Date("2026-05-01T00:00:00.000Z"),
        status: "sent",
        createdAt: oldCreatedAt,
        updatedAt: oldCreatedAt,
      },
      {
        sessionId: freshSession.id,
        userId: user.id,
        scheduledFor: new Date("2026-06-01T00:00:00.000Z"),
        status: "sent",
        createdAt: cutoff,
        updatedAt: cutoff,
      },
    ]);
    await database.db.insert(followUpObservations).values({
      userId: user.id,
      sessionId: oldSession.id,
      outcome: "up",
      observedAt: new Date("2026-05-01T00:01:00.000Z"),
      minutesAfterCompletion: 16,
      operationId: "retention-observation",
    });

    const maintenance = new PostgresNotificationMaintenanceRepository(database.db);
    await expect(maintenance.pruneBefore(cutoff)).resolves.toEqual({
      wakeDeleted: 1,
      followUpDeleted: 1,
    });
    expect(
      await database.db.query.notificationDeliveries.findMany({
        where: (table, { eq }) => eq(table.scheduleUserId, user.id),
      }),
    ).toHaveLength(1);
    expect(
      await database.db.query.followUpNotificationDeliveries.findMany({
        where: (table, { eq }) => eq(table.userId, user.id),
      }),
    ).toHaveLength(1);
    expect(
      await database.db.query.wakeSessions.findMany({
        where: (table, { eq }) => eq(table.userId, user.id),
      }),
    ).toHaveLength(2);
    expect(
      await database.db.query.followUpObservations.findMany({
        where: (table, { eq }) => eq(table.userId, user.id),
      }),
    ).toHaveLength(1);
    await expect(maintenance.pruneBefore(cutoff)).resolves.toEqual({
      wakeDeleted: 0,
      followUpDeleted: 0,
    });
    await deletion.deleteUser(user.id, "retention-cleanup-after");
  });
});
