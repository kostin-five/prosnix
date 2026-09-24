import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresAnalyticsRepository,
  PostgresBootstrapRepository,
  PostgresCoachInsightRepository,
  PostgresSessionCommandRepository,
  PostgresSessionHistoryRepository,
  PostgresUserDeletionRepository,
  PostgresWakeScheduleRepository,
  taskObservations,
} from "@awc/db";
import { taskSuccessTarget } from "@awc/domain";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;
const telegramIds = [910000000001n, 910000000002n] as const;

describe.runIf(Boolean(databaseUrl) && localDatabase)("PostgreSQL фундамент", () => {
  const connections: Array<ReturnType<typeof connectDatabase>> = [];

  function connect() {
    const connection = connectDatabase(databaseUrl!);
    connections.push(connection);
    return connection;
  }

  afterAll(async () => {
    await Promise.all(connections.map((connection) => connection.close()));
  });

  it("подтверждает готовность реальным запросом к PostgreSQL", async () => {
    const database = connect();
    await expect(database.check()).resolves.toBeUndefined();
  });

  it("сохраняет restart, аналитику и изолированное удаление в реальной базе", async () => {
    let database = connect();
    const [first, second] = await database.unitOfWork.transaction(async ({ users }) =>
      Promise.all([
        users.createFromTelegram({ telegramUserId: telegramIds[0], locale: "ru" }),
        users.createFromTelegram({ telegramUserId: telegramIds[1], locale: "ru" }),
      ]),
    );
    const deletion = new PostgresUserDeletionRepository(database.db);
    await deletion.deleteUser(first.id, "cleanup-before-test-1");
    await deletion.deleteUser(second.id, "cleanup-before-test-2");
    [database] = [connect()];
    const [user, untouchedUser] = await database.unitOfWork.transaction(async ({ users }) =>
      Promise.all([
        users.createFromTelegram({ telegramUserId: telegramIds[0], locale: "ru" }),
        users.createFromTelegram({ telegramUserId: telegramIds[1], locale: "ru" }),
      ]),
    );

    const commands = new PostgresSessionCommandRepository(database.db);
    const createEnvelope = {
      userId: user.id,
      operationId: "postgres-create-0001",
      requestHash: "create-hash",
      observedAt: new Date("2026-08-29T06:00:00.000Z"),
      command: {
        type: "create" as const,
        timezone: "Europe/Moscow",
        wakeContext: "night_sleep" as const,
        durationMinutes: 5 as const,
      },
    };
    const created = await commands.execute(createEnvelope);
    expect((await commands.execute(createEnvelope)).replayed).toBe(true);

    let current = (
      await commands.execute({
        userId: user.id,
        operationId: "postgres-baseline-0001",
        requestHash: "baseline-hash",
        observedAt: new Date("2026-08-29T06:00:10.000Z"),
        command: { type: "baseline", sessionId: created.session.id, expectedVersion: 1, value: 3 },
      })
    ).session;
    const firstStep = current.assignment.steps[0]!;
    const firstStepTarget = taskSuccessTarget(firstStep.taskId, current.durationMinutes);
    current = (
      await commands.execute({
        userId: user.id,
        operationId: "postgres-task-0001",
        requestHash: "task-1-hash",
        observedAt: new Date("2026-08-29T06:00:20.000Z"),
        command: {
          type: "task",
          sessionId: current.id,
          expectedVersion: current.version,
          stepIndex: 0,
          taskId: firstStep.taskId,
          correct: firstStepTarget,
          total: firstStepTarget,
          durationMs: 1000,
          difficultyLevel: 2,
        },
      })
    ).session;

    await database.close();
    database = connect();
    const resumed = await new PostgresBootstrapRepository(database.db).load(user.id);
    expect(resumed?.activeSession?.session.currentStepIndex).toBe(1);
    const persistedTasks = (await database.db.select().from(taskObservations)).filter(
      (task) => task.sessionId === current.id,
    );
    expect(persistedTasks[0]).toMatchObject({
      protocolStepIndex: 0,
      difficultyLevel: 2,
    });

    const resumedCommands = new PostgresSessionCommandRepository(database.db);
    for (const step of current.assignment.steps.slice(1)) {
      const target = taskSuccessTarget(step.taskId, current.durationMinutes);
      current = (
        await resumedCommands.execute({
          userId: user.id,
          operationId: `postgres-task-${step.index + 1}`,
          requestHash: `task-${step.index + 1}-hash`,
          observedAt: new Date(`2026-08-29T06:00:${20 + step.index}.000Z`),
          command: {
            type: "task",
            sessionId: current.id,
            expectedVersion: current.version,
            stepIndex: step.index,
            taskId: step.taskId,
            correct: target,
            total: target,
            durationMs: 1000,
          },
        })
      ).session;
    }
    current = (
      await resumedCommands.execute({
        userId: user.id,
        operationId: "postgres-post-rating-0001",
        requestHash: "post-rating-hash",
        observedAt: new Date("2026-08-29T06:01:00.000Z"),
        command: {
          type: "post_rating",
          sessionId: current.id,
          expectedVersion: current.version,
          value: 7,
        },
      })
    ).session;
    await resumedCommands.execute({
      userId: user.id,
      operationId: "postgres-follow-up-0001",
      requestHash: "follow-up-hash",
      observedAt: new Date("2026-08-29T06:16:00.000Z"),
      command: { type: "follow_up", sessionId: current.id, outcome: "up" },
    });

    const profile = await new PostgresAnalyticsRepository(database.db).recompute(user.id);
    expect(profile.averageDelta).toMatchObject({ value: 4, evidenceCount: 1 });
    expect(profile.riseSuccess).toMatchObject({ value: 1, evidenceCount: 1 });
    expect(profile.sequenceEffects).toEqual([]);
    expect(profile.dailyTrend).toEqual([
      {
        localDate: "2026-08-29",
        averageDelta: 4,
        evidenceCount: 1,
        sessionIds: [current.id],
      },
    ]);

    const history = new PostgresSessionHistoryRepository(database.db);
    expect(await history.listCompleted(user.id, 10)).toMatchObject([
      { id: current.id, baseline: 3, postRating: 7, followUp: "up" },
    ]);
    expect(await history.listCompleted(untouchedUser.id, 10)).toEqual([]);

    const coach = new PostgresCoachInsightRepository(database.db);
    await coach.save({
      userId: user.id,
      evidenceFingerprint: "fingerprint-1",
      summary: "Наблюдение",
      nextExperiment: "Следующий протокол",
      caveat: "Предварительный вывод",
      model: "deepseek-v4-flash",
      evidenceCount: 3,
      generatedAt: new Date("2026-08-29T06:20:00.000Z"),
    });
    expect(await coach.findByUserId(user.id)).toMatchObject({
      evidenceFingerprint: "fingerprint-1",
    });

    const schedules = new PostgresWakeScheduleRepository(database.db);
    await schedules.save({
      userId: user.id,
      localTime: "07:00",
      timezone: "Europe/Moscow",
      enabled: true,
      nextTriggerAt: new Date("2026-08-30T04:00:00.000Z"),
      now: new Date("2026-08-29T06:21:00.000Z"),
    });
    const firstSnooze = await schedules.snooze(
      user.id,
      "postgres-snooze-0001",
      new Date("2026-08-29T06:26:00.000Z"),
      new Date("2026-08-29T06:21:00.000Z"),
    );
    const replayedSnooze = await schedules.snooze(
      user.id,
      "postgres-snooze-0001",
      new Date("2026-08-29T06:40:00.000Z"),
      new Date("2026-08-29T06:35:00.000Z"),
    );
    expect(firstSnooze).toMatchObject({
      status: "applied",
      schedule: { localTime: "07:00", revision: 2 },
    });
    expect(replayedSnooze).toMatchObject({
      status: "replayed",
      schedule: {
        localTime: "07:00",
        revision: 2,
        nextTriggerAt: new Date("2026-08-29T06:26:00.000Z"),
      },
    });

    const deleteRepository = new PostgresUserDeletionRepository(database.db);
    expect(await deleteRepository.deleteUser(user.id, "postgres-delete-user-1")).toBe(true);
    expect(await coach.findByUserId(user.id)).toBeNull();
    expect(await history.listCompleted(user.id, 10)).toEqual([]);
    const ownership = await database.unitOfWork.transaction(async ({ users }) => ({
      deleted: await users.findByTelegramId(telegramIds[0]),
      untouched: await users.findByTelegramId(telegramIds[1]),
    }));
    expect(ownership.deleted).toBeNull();
    expect(ownership.untouched?.id).toBe(untouchedUser.id);
    await deleteRepository.deleteUser(untouchedUser.id, "postgres-delete-user-2");
  });
});
