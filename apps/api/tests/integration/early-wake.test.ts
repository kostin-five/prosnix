import { afterAll, describe, expect, it } from "vitest";
import {
  connectDatabase,
  PostgresSessionCommandRepository,
  PostgresSessionHistoryRepository,
  PostgresAnalyticsRepository,
  PostgresUserDeletionRepository,
  sql,
} from "@awc/db";
import type { SessionCommand } from "@awc/domain";

const url = process.env.DATABASE_URL;
const local = url ? ["localhost", "127.0.0.1"].includes(new URL(url).hostname) : false;
describe.runIf(Boolean(url) && local)("PostgreSQL досрочное пробуждение", () => {
  const database = connectDatabase(url!);
  const telegramUserId = 910000009501n;
  const deletion = new PostgresUserDeletionRepository(database.db);
  afterAll(async () => {
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.findByTelegramId(telegramUserId),
    );
    if (user) await deletion.deleteUser(user.id, "early-cleanup");
    await database.close();
  });
  it("сохраняет раннюю оценку, idempotency и историю, исключая её из полного эксперимента", async () => {
    const prior = await database.unitOfWork.transaction(({ users }) =>
      users.findByTelegramId(telegramUserId),
    );
    if (prior) await deletion.deleteUser(prior.id, "early-reset");
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    const repository = new PostgresSessionCommandRepository(database.db, {
      wakeLowEffectRecoveryEnabled: true,
    });
    const send = (id: string, command: SessionCommand) =>
      repository.execute({
        userId: user.id,
        operationId: id,
        requestHash: id,
        observedAt: new Date("2026-10-05T06:00:00Z"),
        command,
      });
    const created = await send("early-create", {
      type: "create",
      timezone: "Europe/Moscow",
      wakeContext: "night_sleep",
      durationMinutes: 5,
    });
    const active = await send("early-baseline", {
      type: "baseline",
      sessionId: created.session.id,
      expectedVersion: created.session.version,
      value: 3,
    });
    const command: SessionCommand = {
      type: "post_rating",
      sessionId: active.session.id,
      expectedVersion: active.session.version,
      value: 4,
      completionReason: "awakened",
    };
    const early = await send("early-post", command);
    expect(early.session).toMatchObject({
      status: "protocol_completed",
      tasks: [],
      currentStepIndex: 0,
      postRating: 4,
      experience: { completedEarly: true },
      recoveryOffer: null,
    });
    expect((await send("early-post", command)).session).toEqual(early.session);
    await expect(send("early-stale", command)).rejects.toMatchObject({ code: "stale_version" });
    await expect(
      send("early-recovery", {
        type: "start_recovery",
        sessionId: early.session.id,
        expectedVersion: early.session.version,
      }),
    ).rejects.toMatchObject({ code: "recovery_unavailable" });
    const history = await new PostgresSessionHistoryRepository(database.db).listCompleted(
      user.id,
      10,
    );
    expect(history).toMatchObject([
      { completedEarly: true, baseline: 3, postRating: 4, tasks: [] },
    ]);
    const profile = await new PostgresAnalyticsRepository(database.db).recompute(user.id);
    expect(profile.averageDelta.evidenceCount).toBe(0);
    const updated = await database.db.execute(
      sql`select learning_session_count from users where id = ${user.id}`,
    );
    expect(updated[0]?.learning_session_count).toBe(0);
    const followUp = await send("early-follow-up", {
      type: "follow_up",
      sessionId: early.session.id,
      outcome: "up",
    });
    expect(followUp.session.followUp).toBe("up");
  });
});
