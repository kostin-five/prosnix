import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresSessionCommandRepository,
  PostgresUserDeletionRepository,
  taskObservations,
} from "@awc/db";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)("PostgreSQL hands-free wake", () => {
  const database = connectDatabase(databaseUrl!);
  const telegramUserId = 910000009201n;
  const deletion = new PostgresUserDeletionRepository(database.db);
  afterAll(async () => {
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.findByTelegramId(telegramUserId),
    );
    if (user) await deletion.deleteUser(user.id, "hands-free-cleanup");
    await database.close();
  });

  it("назначает безэкранные шаги и сохраняет источник timer", async () => {
    const prior = await database.unitOfWork.transaction(({ users }) =>
      users.findByTelegramId(telegramUserId),
    );
    if (prior) await deletion.deleteUser(prior.id, "hands-free-reset");
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    const commands = new PostgresSessionCommandRepository(database.db);
    const created = await commands.execute({
      userId: user.id,
      operationId: "hands-free-create-1",
      requestHash: "hands-free-create-hash",
      observedAt: new Date("2026-09-30T04:00:00.000Z"),
      command: {
        type: "create",
        timezone: "Europe/Moscow",
        wakeContext: "night_sleep",
        durationMinutes: 2,
        interactionMode: "hands_free",
      },
    });
    expect(created.session.experience?.interactionMode).toBe("hands_free");
    expect(created.session.assignment.protocolVersion).toBe(13);
    expect(created.session.assignment.steps.map(({ taskId }) => taskId)).toEqual([
      "notice_three",
      "find_color",
    ]);
    const baseline = await commands.execute({
      userId: user.id,
      operationId: "hands-free-baseline-1",
      requestHash: "hands-free-baseline-hash",
      observedAt: new Date("2026-09-30T04:00:10.000Z"),
      command: {
        type: "baseline",
        sessionId: created.session.id,
        expectedVersion: created.session.version,
        value: 3,
        experience: { soundMode: "on" },
      },
    });
    expect(baseline.session.experience).toMatchObject({
      soundMode: "on",
      interactionMode: "hands_free",
    });
    const first = await commands.execute({
      userId: user.id,
      operationId: "hands-free-task-1",
      requestHash: "hands-free-task-hash",
      observedAt: new Date("2026-09-30T04:00:25.000Z"),
      command: {
        type: "task",
        sessionId: created.session.id,
        expectedVersion: baseline.session.version,
        stepIndex: 0,
        taskId: "notice_three",
        correct: 1,
        total: 1,
        durationMs: 15_000,
        completionSource: "timer",
      },
    });
    expect(first.session.tasks[0]?.completionSource).toBe("timer");
    const rows = await database.db.select().from(taskObservations);
    expect(rows.find(({ sessionId }) => sessionId === created.session.id)?.completionSource).toBe(
      "timer",
    );
  });
});
