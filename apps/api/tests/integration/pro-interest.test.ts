import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresAdminGrowthRepository,
  PostgresProInterestRepository,
  PostgresUserDeletionRepository,
  sql,
} from "@awc/db";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)(
  "PostgreSQL исследования интереса к Pro",
  () => {
    const database = connectDatabase(databaseUrl!);
    const telegramUserId = 910000000013n;

    afterAll(async () => {
      const user = await database.unitOfWork.transaction(({ users }) =>
        users.findByTelegramId(telegramUserId),
      );
      if (user) {
        await new PostgresUserDeletionRepository(database.db).deleteUser(
          user.id,
          "pro-interest-cleanup",
        );
      }
      await database.close();
    });

    it("разрешает один ответ после семи сессий и удаляет его вместе с профилем", async () => {
      let user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );
      const deletion = new PostgresUserDeletionRepository(database.db);
      await deletion.deleteUser(user.id, "pro-interest-cleanup-before");
      user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );

      const protocolId = "00000000-0000-4000-8000-000000000220";
      await database.db.execute(
        sql`delete from protocol_definitions where id = ${protocolId}::uuid`,
      );
      await database.db.execute(sql`
      insert into protocol_definitions (id, protocol_key, version, title, steps, active_from)
      values (${protocolId}::uuid, 'pro-interest-fixture', 1, 'Pro interest fixture', '[]'::jsonb, now())
    `);
      for (let index = 1; index <= 7; index += 1) {
        const suffix = 220 + index;
        const assignmentId = `00000000-0000-4000-8000-000000000${suffix}`;
        const sessionId = `00000000-0000-4000-8000-000000000${230 + index}`;
        await database.db.execute(sql`
        insert into experiment_assignments
          (id, user_id, protocol_definition_id, strategy_version, phase, hypothesis, assigned_at)
        values (${assignmentId}::uuid, ${user.id}::uuid, ${protocolId}::uuid, 'pro-interest-v1', 'learning', 'fixture', now())
      `);
        await database.db.execute(sql`
        insert into wake_sessions
          (id, user_id, assignment_id, status, current_step_index, version, wake_context,
           duration_budget_minutes, personalization_snapshot, protocol_completed_at)
        values (${sessionId}::uuid, ${user.id}::uuid, ${assignmentId}::uuid, 'protocol_completed', 0, 1,
                'night_sleep', 5, '{}'::jsonb, now())
      `);
      }

      const interest = new PostgresProInterestRepository(database.db);
      expect(await interest.status(user.id)).toEqual({ eligible: true, submitted: false });
      expect(
        await interest.submit({
          userId: user.id,
          intent: "interested",
          interestFocus: "both",
          now: new Date("2026-09-07T12:00:00.000Z"),
        }),
      ).toEqual({ eligible: true, submitted: true });
      expect(
        await interest.submit({
          userId: user.id,
          intent: "not_interested",
          now: new Date("2026-09-07T12:01:00.000Z"),
        }),
      ).toEqual({ eligible: true, submitted: true });
      const rows = await database.db.execute<{ count: number }>(sql`
      select count(*)::int as count from pro_interest_responses where user_id = ${user.id}::uuid
    `);
      expect(Number(rows[0]?.count)).toBe(1);
      const aggregate = await new PostgresAdminGrowthRepository(database.db).summarize(
        new Date("2026-09-01T00:00:00.000Z"),
        new Date("2026-09-08T00:00:00.000Z"),
      );
      expect(aggregate.breakdowns.proInterest).toEqual({
        responses: 1,
        interested: 1,
        notNow: 0,
        notInterested: 0,
        longHistory: 0,
        deeperExperiments: 0,
        both: 1,
      });

      await deletion.deleteUser(user.id, "pro-interest-cleanup-after");
      expect(await interest.status(user.id)).toEqual({ eligible: false, submitted: false });
      await database.db.execute(
        sql`delete from protocol_definitions where id = ${protocolId}::uuid`,
      );
    });
  },
);
