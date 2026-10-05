import { afterAll, describe, expect, it } from "vitest";
import {
  connectDatabase,
  PostgresSessionCommandRepository,
  PostgresUserDeletionRepository,
} from "@awc/db";
import { taskSuccessTarget, type SessionCommand } from "@awc/domain";

const url = process.env.DATABASE_URL;
const local = url ? ["localhost", "127.0.0.1"].includes(new URL(url).hostname) : false;
describe.runIf(Boolean(url) && local)("PostgreSQL адаптивный режим без телефона", () => {
  const database = connectDatabase(url!);
  const telegramUserId = 910000009502n;
  const deletion = new PostgresUserDeletionRepository(database.db);
  afterAll(async () => {
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.findByTelegramId(telegramUserId),
    );
    if (user) await deletion.deleteUser(user.id, "hands-free-cleanup");
    await database.close();
  });
  it("использует историю своего режима и сохраняет назначение при повторе команды", async () => {
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    const repository = new PostgresSessionCommandRepository(database.db);
    let counter = 0;
    const send = (id: string, command: SessionCommand) =>
      repository.execute({
        userId: user.id,
        operationId: id,
        requestHash: id,
        observedAt: new Date(Date.UTC(2026, 9, 5, 6, 0, counter++)),
        command,
      });
    const create = {
      type: "create",
      timezone: "Europe/Moscow",
      wakeContext: "night_sleep",
      durationMinutes: 2,
      interactionMode: "hands_free",
    } as const;
    const first = await send("hf-create-1", create);
    let session = (
      await send("hf-baseline", {
        type: "baseline",
        sessionId: first.session.id,
        expectedVersion: first.session.version,
        value: 3,
      })
    ).session;
    for (const step of session.assignment.steps) {
      const target = taskSuccessTarget(step.taskId, 2, session.assignment.protocolVersion);
      session = (
        await send(`hf-task-${step.index}`, {
          type: "task",
          sessionId: session.id,
          expectedVersion: session.version,
          stepIndex: step.index,
          taskId: step.taskId,
          correct: target,
          total: target,
          durationMs: 30000,
        })
      ).session;
    }
    await send("hf-post", {
      type: "post_rating",
      sessionId: session.id,
      expectedVersion: session.version,
      value: 4,
    });
    const manual = await send("manual-between", { ...create, interactionMode: "manual" });
    await send("manual-abandon", {
      type: "abandon",
      sessionId: manual.session.id,
      expectedVersion: manual.session.version,
    });
    const next = await send("hf-create-2", create);
    expect(next.session.assignment.steps).not.toEqual(first.session.assignment.steps);
    expect(next.session.assignment.strategyVersion).toBe("hands-free-adaptive-v2");
    expect(
      next.session.assignment.steps.every(
        ({ taskId }) => !["math", "memory", "reaction", "stroop"].includes(taskId),
      ),
    ).toBe(true);
    expect((await send("hf-create-2", create)).session.assignment).toEqual(next.session.assignment);
  });
});
