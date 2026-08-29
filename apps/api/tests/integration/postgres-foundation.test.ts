import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresAnalyticsRepository,
  PostgresBootstrapRepository,
  PostgresSessionCommandRepository,
  PostgresUserDeletionRepository,
} from "@awc/db";

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
      command: { type: "create" as const, timezone: "Europe/Moscow" },
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
          correct: 1,
          total: 1,
          durationMs: 1000,
        },
      })
    ).session;

    await database.close();
    database = connect();
    const resumed = await new PostgresBootstrapRepository(database.db).load(user.id);
    expect(resumed?.activeSession?.session.currentStepIndex).toBe(1);

    const resumedCommands = new PostgresSessionCommandRepository(database.db);
    for (const step of current.assignment.steps.slice(1)) {
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
            correct: 1,
            total: 1,
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

    const deleteRepository = new PostgresUserDeletionRepository(database.db);
    expect(await deleteRepository.deleteUser(user.id, "postgres-delete-user-1")).toBe(true);
    const ownership = await database.unitOfWork.transaction(async ({ users }) => ({
      deleted: await users.findByTelegramId(telegramIds[0]),
      untouched: await users.findByTelegramId(telegramIds[1]),
    }));
    expect(ownership.deleted).toBeNull();
    expect(ownership.untouched?.id).toBe(untouchedUser.id);
    await deleteRepository.deleteUser(untouchedUser.id, "postgres-delete-user-2");
  });
});
