import { afterAll, describe, expect, it } from "vitest";

import { connectDatabase, PostgresAdminGrowthRepository, sql } from "@awc/db";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)("PostgreSQL admin dashboard", () => {
  const database = connectDatabase(databaseUrl!);
  const userOne = "00000000-0000-4000-8000-000000008001";
  const userTwo = "00000000-0000-4000-8000-000000008002";
  const protocol = "00000000-0000-4000-8000-000000008010";
  const sessionOne = "00000000-0000-4000-8000-000000008201";
  const sessionTwo = "00000000-0000-4000-8000-000000008202";
  const sessionThree = "00000000-0000-4000-8000-000000008203";

  afterAll(async () => {
    await database.db.execute(
      sql`delete from users where id in (${userOne}::uuid, ${userTwo}::uuid)`,
    );
    await database.db.execute(sql`delete from protocol_definitions where id = ${protocol}::uuid`);
    await database.close();
  });

  it("считает одну когорту, парный эффект, timeline и использование функций", async () => {
    await database.db.execute(
      sql`delete from users where id in (${userOne}::uuid, ${userTwo}::uuid)`,
    );
    await database.db.execute(sql`delete from protocol_definitions where id = ${protocol}::uuid`);

    await database.db.execute(sql`
      insert into users (id, telegram_user_id, locale, timezone, created_at, updated_at)
      values
        (${userOne}::uuid, 910000008001, 'ru', 'UTC', '2036-08-29T13:00:00Z', '2036-08-29T13:00:00Z'),
        (${userTwo}::uuid, 910000008002, 'ru', 'UTC', '2036-09-03T13:00:00Z', '2036-09-03T13:00:00Z')
    `);
    await database.db.execute(sql`
      insert into protocol_definitions (id, protocol_key, version, title, steps, active_from)
      values (${protocol}::uuid, 'admin-fixture', 1, 'Admin fixture', '[]'::jsonb, '2036-08-01T00:00:00Z')
    `);
    await database.db.execute(sql`
      insert into experiment_assignments
        (id, user_id, protocol_definition_id, strategy_version, phase, hypothesis, assigned_at)
      values
        ('00000000-0000-4000-8000-000000008101', ${userOne}::uuid, ${protocol}::uuid, 'fixture-v1', 'learning', 'fixture', '2036-08-30T13:00:00Z'),
        ('00000000-0000-4000-8000-000000008102', ${userTwo}::uuid, ${protocol}::uuid, 'fixture-v1', 'learning', 'fixture', '2036-09-03T13:00:00Z'),
        ('00000000-0000-4000-8000-000000008103', ${userTwo}::uuid, ${protocol}::uuid, 'fixture-v1', 'learning', 'fixture', '2036-09-04T13:00:00Z')
    `);
    await database.db.execute(sql`
      insert into wake_sessions
        (id, user_id, assignment_id, status, current_step_index, version, wake_context,
         duration_budget_minutes, personalization_snapshot, started_at, protocol_completed_at,
         follow_up_due_at, created_at, updated_at)
      values
        (${sessionOne}::uuid, ${userOne}::uuid, '00000000-0000-4000-8000-000000008101', 'protocol_completed', 1, 3, 'night_sleep', 5, '{}'::jsonb,
         '2036-08-30T13:10:00Z', '2036-08-30T13:20:00Z', '2036-08-30T13:35:00Z', '2036-08-30T13:00:00Z', '2036-08-30T13:20:00Z'),
        (${sessionTwo}::uuid, ${userTwo}::uuid, '00000000-0000-4000-8000-000000008102', 'in_progress', 0, 2, 'short_nap', 2, '{}'::jsonb,
         '2036-09-03T13:10:00Z', null, null, '2036-09-03T13:00:00Z', '2036-09-03T13:10:00Z'),
        (${sessionThree}::uuid, ${userTwo}::uuid, '00000000-0000-4000-8000-000000008103', 'abandoned', 0, 1, 'energy_reset', 10, '{}'::jsonb,
         null, null, null, '2036-09-04T13:00:00Z', '2036-09-04T13:00:00Z')
    `);
    await database.db.execute(sql`
      insert into rating_observations
        (user_id, session_id, kind, value, observed_at, operation_id)
      values
        (${userOne}::uuid, ${sessionOne}::uuid, 'baseline', 2, '2036-08-30T13:10:00Z', 'admin-baseline'),
        (${userOne}::uuid, ${sessionOne}::uuid, 'post_protocol', 6, '2036-08-30T13:20:00Z', 'admin-post'),
        (${userTwo}::uuid, ${sessionTwo}::uuid, 'baseline', 3, '2036-09-03T13:10:00Z', 'admin-unpaired')
    `);
    await database.db.execute(sql`
      insert into follow_up_observations
        (user_id, session_id, outcome, observed_at, minutes_after_completion, operation_id)
      values (${userOne}::uuid, ${sessionOne}::uuid, 'up', '2036-08-30T13:36:00Z', 16, 'admin-follow-up')
    `);
    await database.db.execute(sql`
      insert into wake_capability_profiles
        (user_id, movement_level, available_resources, excluded_task_ids, default_duration_minutes,
         onboarding_completed_at, created_at, updated_at)
      values (${userOne}::uuid, 'light', '[]'::jsonb, '[]'::jsonb, 5,
        '2036-08-29T14:00:00Z', '2036-08-29T14:00:00Z', '2036-08-29T14:00:00Z')
    `);
    await database.db.execute(sql`
      insert into wake_routines (user_id, enabled, items, created_at, updated_at)
      values (${userOne}::uuid, true, '[{"id":"water","title":"Вода"}]'::jsonb,
        '2036-08-29T14:00:00Z', '2036-08-29T14:00:00Z')
    `);
    await database.db.execute(sql`
      insert into wake_routine_runs
        (session_id, user_id, items_snapshot, completed_item_ids, created_at, updated_at, completed_at)
      values (${sessionOne}::uuid, ${userOne}::uuid,
        '[{"id":"water","title":"Вода"}]'::jsonb, '["water"]'::jsonb,
        '2036-08-30T13:21:00Z', '2036-08-30T13:22:00Z', '2036-08-30T13:22:00Z')
    `);
    await database.db.execute(sql`
      insert into coach_insights
        (user_id, evidence_fingerprint, summary, next_experiment, caveat, model,
         evidence_count, generated_at, updated_at)
      values (${userOne}::uuid, 'admin-fixture', 'summary', 'next', 'caveat', 'fixture',
        3, '2036-08-31T12:00:00Z', '2036-08-31T12:00:00Z')
    `);
    await database.db.execute(sql`
      insert into wake_schedules
        (user_id, local_time, timezone, enabled, next_trigger_at, bot_status, created_at, updated_at)
      values (${userOne}::uuid, '08:00', 'UTC', false, null, 'available',
        '2036-08-29T13:00:00Z', '2036-08-29T13:00:00Z')
    `);
    await database.db.execute(sql`
      insert into notification_deliveries
        (schedule_user_id, scheduled_for, status, attempts, created_at, updated_at, sent_at)
      values
        (${userOne}::uuid, '2036-08-31T08:00:00Z', 'sent', 1, '2036-08-31T08:00:00Z', '2036-08-31T08:00:00Z', '2036-08-31T08:00:00Z'),
        (${userOne}::uuid, '2036-09-01T08:00:00Z', 'failed', 2, '2036-09-01T08:00:00Z', '2036-09-01T08:01:00Z', null)
    `);
    await database.db.execute(sql`
      insert into follow_up_notification_deliveries
        (session_id, user_id, scheduled_for, status, attempts, created_at, updated_at)
      values (${sessionOne}::uuid, ${userOne}::uuid, '2036-08-30T13:35:00Z', 'blocked', 1,
        '2036-08-30T13:35:00Z', '2036-08-30T13:35:00Z')
    `);

    const summary = await new PostgresAdminGrowthRepository(database.db).summarize(
      new Date("2036-08-29T12:00:00.000Z"),
      new Date("2036-09-05T12:00:00.000Z"),
    );

    expect(summary.users).toMatchObject({ new: 2, active: 2 });
    expect(summary.funnel).toEqual({ assigned: 3, started: 2, completed: 1, followedUp: 1 });
    expect(summary.wakeQuality).toEqual({
      pairedSessions: 1,
      averageDelta: 4,
      improvedSessions: 1,
    });
    expect(summary.followUp).toEqual({ eligible: 1, answered: 1, up: 1, back: 0, drowsy: 0 });
    expect(summary.timeline).toHaveLength(7);
    expect(summary.timeline.some((point) => point.startedSessions === 1)).toBe(true);
    expect(summary.breakdowns.contexts).toEqual(
      expect.arrayContaining([
        { key: "night_sleep", sessions: 1, completed: 1 },
        { key: "short_nap", sessions: 1, completed: 0 },
      ]),
    );
    expect(summary.breakdowns.durations).toEqual(
      expect.arrayContaining([{ minutes: 5, sessions: 1, completed: 1 }]),
    );
    expect(summary.features).toEqual({
      capabilityProfiles: 1,
      routinesEnabled: 1,
      routineRuns: 1,
      routineRunsCompleted: 1,
      aiInsightsGenerated: 1,
    });
    expect(summary.deliveries).toEqual({
      dailySent: 1,
      followUpSent: 0,
      failed: 1,
      blocked: 1,
    });
  });
});
