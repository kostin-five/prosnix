import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresExperimentFeedbackRepository,
  PostgresUserDeletionRepository,
  sql,
} from "@awc/db";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)("PostgreSQL feedback эксперимента", () => {
  const database = connectDatabase(databaseUrl!);
  const telegramUserId = 910000000012n;

  afterAll(async () => {
    const user = await database.unitOfWork.transaction(({ users }) =>
      users.findByTelegramId(telegramUserId),
    );
    if (user) {
      await new PostgresUserDeletionRepository(database.db).deleteUser(user.id, "feedback-cleanup");
    }
    await database.close();
  });

  it("разрешает один feedback только после пяти сессий и удаляет его вместе с профилем", async () => {
    let user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );
    const deletion = new PostgresUserDeletionRepository(database.db);
    await deletion.deleteUser(user.id, "feedback-cleanup-before");
    user = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId, locale: "ru" }),
    );

    const protocolId = "00000000-0000-4000-8000-000000000120";
    await database.db.execute(sql`delete from protocol_definitions where id = ${protocolId}::uuid`);
    await database.db.execute(sql`
      insert into protocol_definitions (id, protocol_key, version, title, steps, active_from)
      values (${protocolId}::uuid, 'feedback-fixture', 1, 'Feedback fixture', '[]'::jsonb, now())
    `);
    for (let index = 1; index <= 5; index += 1) {
      const assignmentId = `00000000-0000-4000-8000-0000000001${20 + index}`;
      const sessionId = `00000000-0000-4000-8000-0000000001${30 + index}`;
      await database.db.execute(sql`
        insert into experiment_assignments
          (id, user_id, protocol_definition_id, strategy_version, phase, hypothesis, assigned_at)
        values (${assignmentId}::uuid, ${user.id}::uuid, ${protocolId}::uuid, 'feedback-v1', 'learning', 'fixture', now())
      `);
      await database.db.execute(sql`
        insert into wake_sessions
          (id, user_id, assignment_id, status, current_step_index, version, wake_context,
           duration_budget_minutes, personalization_snapshot, protocol_completed_at)
        values (${sessionId}::uuid, ${user.id}::uuid, ${assignmentId}::uuid, 'protocol_completed', 0, 1,
                'night_sleep', 5, '{}'::jsonb, now())
      `);
    }

    const feedback = new PostgresExperimentFeedbackRepository(database.db);
    expect(await feedback.status(user.id)).toEqual({ eligible: true, submitted: false });
    expect(
      await feedback.submit({
        userId: user.id,
        helpful: 5,
        irritating: 1,
        continueIntent: 5,
        now: new Date("2026-09-07T06:00:00.000Z"),
      }),
    ).toEqual({ eligible: true, submitted: true });
    expect(
      await feedback.submit({
        userId: user.id,
        helpful: 1,
        irritating: 5,
        continueIntent: 1,
        now: new Date("2026-09-07T06:01:00.000Z"),
      }),
    ).toEqual({ eligible: true, submitted: true });

    await deletion.deleteUser(user.id, "feedback-cleanup-after");
    expect(await feedback.status(user.id)).toEqual({ eligible: false, submitted: false });
    await database.db.execute(sql`delete from protocol_definitions where id = ${protocolId}::uuid`);
  });
});
