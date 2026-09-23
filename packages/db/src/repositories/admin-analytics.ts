import { and, eq, inArray, sql } from "drizzle-orm";

import type {
  AdminGrowthRepository,
  AdminGrowthSummary,
  WakeContext,
  WakeDurationMinutes,
} from "@awc/domain";
import { users } from "../schema.js";
import type { Database } from "./types.js";

const number = (value: unknown): number => Number(value ?? 0);
const rounded = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(Number(value).toFixed(2));

export class PostgresAdminGrowthRepository implements AdminGrowthRepository {
  constructor(
    private readonly db: Database,
    private readonly options: { billingEnabled: boolean } = { billingEnabled: true },
  ) {}

  async isAllowed(userId: string, telegramUserIds: readonly bigint[]): Promise<boolean> {
    if (telegramUserIds.length === 0) return false;
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), inArray(users.telegramUserId, [...telegramUserIds])))
      .limit(1);
    return Boolean(row);
  }

  async summarize(from: Date, now: Date): Promise<AdminGrowthSummary> {
    const fromIso = from.toISOString();
    const nowIso = now.toISOString();
    const d1CutoffIso = new Date(now.getTime() - 86_400_000).toISOString();
    const d3CutoffIso = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    const d7CutoffIso = new Date(now.getTime() - 7 * 86_400_000).toISOString();

    const [
      userRows,
      sessionRows,
      qualityRows,
      followUpRows,
      retentionRows,
      secondSessionRows,
      timelineRows,
      contextRows,
      durationRows,
      experimentRows,
      proInterestRows,
      featureRows,
      dailyDeliveryRows,
      followUpDeliveryRows,
      billingRows,
      revenueRows,
    ] = await Promise.all([
      this.db.execute<{ total: number; new_users: number }>(sql`
        select
          count(*)::int as total,
          count(*) filter (
            where created_at >= ${fromIso}::timestamptz and created_at < ${nowIso}::timestamptz
          )::int as new_users
        from users
      `),
      this.db.execute<{
        active_users: number;
        assigned: number;
        started: number;
        baseline_recorded: number;
        completed: number;
        followed_up: number;
        abandoned: number;
      }>(sql`
        select
          count(distinct user_id)::int as active_users,
          count(*)::int as assigned,
          count(*) filter (where started_at is not null and started_at < ${nowIso}::timestamptz)::int as started,
          count(*) filter (where exists (
            select 1 from rating_observations r
            where r.session_id = wake_sessions.id
              and r.kind = 'baseline'
              and r.observed_at < ${nowIso}::timestamptz
          ))::int as baseline_recorded,
          count(*) filter (where protocol_completed_at is not null and protocol_completed_at < ${nowIso}::timestamptz)::int as completed,
          count(*) filter (where exists (
            select 1 from follow_up_observations f
            where f.session_id = wake_sessions.id and f.observed_at < ${nowIso}::timestamptz
          ))::int as followed_up,
          count(*) filter (where abandoned_at is not null and abandoned_at < ${nowIso}::timestamptz)::int as abandoned
        from wake_sessions
        where created_at >= ${fromIso}::timestamptz and created_at < ${nowIso}::timestamptz
      `),
      this.db.execute<{
        paired_sessions: number;
        average_delta: number | null;
        improved_sessions: number;
      }>(sql`
        with paired as (
          select
            s.id,
            max(r.value) filter (where r.kind = 'baseline') as baseline,
            max(r.value) filter (where r.kind = 'post_protocol') as post
          from wake_sessions s
          join rating_observations r on r.session_id = s.id
          where s.created_at >= ${fromIso}::timestamptz and s.created_at < ${nowIso}::timestamptz
            and r.observed_at < ${nowIso}::timestamptz
          group by s.id
        ), deltas as (
          select post - baseline as delta from paired where baseline is not null and post is not null
        )
        select
          count(*)::int as paired_sessions,
          avg(delta)::float as average_delta,
          count(*) filter (where delta > 0)::int as improved_sessions
        from deltas
      `),
      this.db.execute<{
        eligible: number;
        answered: number;
        up: number;
        back: number;
        drowsy: number;
      }>(sql`
        select
          count(*)::int as eligible,
          count(f.id)::int as answered,
          count(f.id) filter (where f.outcome = 'up')::int as up,
          count(f.id) filter (where f.outcome = 'back')::int as back,
          count(f.id) filter (where f.outcome = 'drowsy')::int as drowsy
        from wake_sessions s
        left join follow_up_observations f
          on f.session_id = s.id and f.observed_at < ${nowIso}::timestamptz
        where s.created_at >= ${fromIso}::timestamptz and s.created_at < ${nowIso}::timestamptz
          and s.protocol_completed_at is not null and s.protocol_completed_at < ${nowIso}::timestamptz
      `),
      this.db.execute<{
        d1_eligible: number;
        d1_retained: number;
        d3_eligible: number;
        d3_retained: number;
        d7_eligible: number;
        d7_retained: number;
      }>(sql`
        select
          count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d1CutoffIso}::timestamptz)::int as d1_eligible,
          count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d1CutoffIso}::timestamptz and exists (
            select 1 from wake_sessions s where s.user_id = u.id
              and s.protocol_completed_at < ${nowIso}::timestamptz
              and date_trunc('day', s.protocol_completed_at at time zone 'UTC') = date_trunc('day', u.created_at at time zone 'UTC') + interval '1 day'
          ))::int as d1_retained,
          count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d3CutoffIso}::timestamptz)::int as d3_eligible,
          count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d3CutoffIso}::timestamptz and exists (
            select 1 from wake_sessions s where s.user_id = u.id
              and s.protocol_completed_at < ${nowIso}::timestamptz
              and date_trunc('day', s.protocol_completed_at at time zone 'UTC') = date_trunc('day', u.created_at at time zone 'UTC') + interval '3 days'
          ))::int as d3_retained,
          count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d7CutoffIso}::timestamptz)::int as d7_eligible,
          count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d7CutoffIso}::timestamptz and exists (
            select 1 from wake_sessions s where s.user_id = u.id
              and s.protocol_completed_at < ${nowIso}::timestamptz
              and date_trunc('day', s.protocol_completed_at at time zone 'UTC') = date_trunc('day', u.created_at at time zone 'UTC') + interval '7 days'
          ))::int as d7_retained
        from users u
      `),
      this.db.execute<{
        cohort: number;
        eligible: number;
        returned: number;
        pending: number;
      }>(sql`
        with ranked as (
          select
            user_id,
            protocol_completed_at,
            row_number() over (partition by user_id order by protocol_completed_at, id) as session_number
          from wake_sessions
          where protocol_completed_at is not null
            and protocol_completed_at < ${nowIso}::timestamptz
        ), first_two as (
          select
            user_id,
            max(protocol_completed_at) filter (where session_number = 1) as first_completed_at,
            max(protocol_completed_at) filter (where session_number = 2) as second_completed_at
          from ranked
          where session_number <= 2
          group by user_id
        ), cohort as (
          select *,
            second_completed_at is not null
              and second_completed_at <= first_completed_at + interval '7 days' as returned_in_window
          from first_two
          where first_completed_at >= ${fromIso}::timestamptz
            and first_completed_at < ${nowIso}::timestamptz
        )
        select
          count(*)::int as cohort,
          count(*) filter (
            where returned_in_window or first_completed_at <= ${d7CutoffIso}::timestamptz
          )::int as eligible,
          count(*) filter (where returned_in_window)::int as returned,
          count(*) filter (
            where not returned_in_window and first_completed_at > ${d7CutoffIso}::timestamptz
          )::int as pending
        from cohort
      `),
      this.db.execute<{
        date: string;
        new_users: number;
        started_sessions: number;
        completed_sessions: number;
      }>(sql`
        select
          to_char(bucket at time zone 'UTC', 'YYYY-MM-DD') as date,
          (select count(*) from users u where u.created_at >= bucket and u.created_at < least(bucket + interval '1 day', ${nowIso}::timestamptz))::int as new_users,
          (select count(*) from wake_sessions s where s.created_at >= ${fromIso}::timestamptz and s.created_at < ${nowIso}::timestamptz and s.started_at >= bucket and s.started_at < least(bucket + interval '1 day', ${nowIso}::timestamptz))::int as started_sessions,
          (select count(*) from wake_sessions s where s.created_at >= ${fromIso}::timestamptz and s.created_at < ${nowIso}::timestamptz and s.protocol_completed_at >= bucket and s.protocol_completed_at < least(bucket + interval '1 day', ${nowIso}::timestamptz))::int as completed_sessions
        from generate_series(
          ${fromIso}::timestamptz,
          ${nowIso}::timestamptz - interval '1 microsecond',
          interval '1 day'
        ) as bucket
        order by bucket
      `),
      this.db.execute<{ key: string; sessions: number; completed: number }>(sql`
        select
          wake_context::text as key,
          count(*)::int as sessions,
          count(*) filter (where protocol_completed_at is not null and protocol_completed_at < ${nowIso}::timestamptz)::int as completed
        from wake_sessions
        where created_at >= ${fromIso}::timestamptz and created_at < ${nowIso}::timestamptz
        group by wake_context
        order by wake_context
      `),
      this.db.execute<{ minutes: number; sessions: number; completed: number }>(sql`
        select
          duration_budget_minutes::int as minutes,
          count(*)::int as sessions,
          count(*) filter (where protocol_completed_at is not null and protocol_completed_at < ${nowIso}::timestamptz)::int as completed
        from wake_sessions
        where created_at >= ${fromIso}::timestamptz and created_at < ${nowIso}::timestamptz
        group by duration_budget_minutes
        order by duration_budget_minutes
      `),
      this.db.execute<{ version: string; assigned: number; completed: number }>(sql`
        select
          a.strategy_version as version,
          count(*)::int as assigned,
          count(*) filter (
            where s.protocol_completed_at is not null and s.protocol_completed_at < ${nowIso}::timestamptz
          )::int as completed
        from experiment_assignments a
        join wake_sessions s on s.assignment_id = a.id
        where a.assigned_at >= ${fromIso}::timestamptz and a.assigned_at < ${nowIso}::timestamptz
        group by a.strategy_version
        order by a.strategy_version
      `),
      this.db.execute<{
        responses: number;
        interested: number;
        not_now: number;
        not_interested: number;
        long_history: number;
        deeper_experiments: number;
        both: number;
      }>(sql`
        select
          count(*)::int as responses,
          count(*) filter (where intent = 'interested')::int as interested,
          count(*) filter (where intent = 'not_now')::int as not_now,
          count(*) filter (where intent = 'not_interested')::int as not_interested,
          count(*) filter (where interest_focus = 'long_history')::int as long_history,
          count(*) filter (where interest_focus = 'deeper_experiments')::int as deeper_experiments,
          count(*) filter (where interest_focus = 'both')::int as both
        from pro_interest_responses
        where created_at >= ${fromIso}::timestamptz and created_at < ${nowIso}::timestamptz
      `),
      this.db.execute<{
        capability_profiles: number;
        routines_enabled: number;
        routine_runs: number;
        routine_runs_completed: number;
        ai_insights_generated: number;
      }>(sql`
        select
          (select count(*) from wake_capability_profiles
            where onboarding_completed_at >= ${fromIso}::timestamptz
              and onboarding_completed_at < ${nowIso}::timestamptz)::int as capability_profiles,
          (select count(*) from wake_routines
            where enabled = true
              and created_at >= ${fromIso}::timestamptz
              and created_at < ${nowIso}::timestamptz)::int as routines_enabled,
          (select count(*) from wake_routine_runs where created_at >= ${fromIso}::timestamptz and created_at < ${nowIso}::timestamptz)::int as routine_runs,
          (select count(*) from wake_routine_runs where created_at >= ${fromIso}::timestamptz and created_at < ${nowIso}::timestamptz and completed_at is not null and completed_at < ${nowIso}::timestamptz)::int as routine_runs_completed,
          (select count(*) from coach_insights where generated_at >= ${fromIso}::timestamptz and generated_at < ${nowIso}::timestamptz)::int as ai_insights_generated
      `),
      this.db.execute<{ sent: number; failed: number; blocked: number }>(sql`
        select
          count(*) filter (where status = 'sent')::int as sent,
          count(*) filter (where status in ('failed', 'ambiguous'))::int as failed,
          count(*) filter (where status = 'blocked')::int as blocked
        from notification_deliveries
        where created_at >= ${fromIso}::timestamptz and created_at < ${nowIso}::timestamptz
      `),
      this.db.execute<{ sent: number; failed: number; blocked: number }>(sql`
        select
          count(*) filter (where status = 'sent')::int as sent,
          count(*) filter (where status in ('failed', 'ambiguous'))::int as failed,
          count(*) filter (where status = 'blocked')::int as blocked
        from follow_up_notification_deliveries
        where created_at >= ${fromIso}::timestamptz and created_at < ${nowIso}::timestamptz
      `),
      this.options.billingEnabled
        ? this.db.execute<{ active: number }>(sql`
            select count(*) filter (
              where status::text in ('active', 'canceled', 'past_due')
                and current_period_end > ${nowIso}::timestamptz
            )::int as active
            from subscriptions
          `)
        : Promise.resolve([{ active: 0 }]),
      this.options.billingEnabled
        ? this.db.execute<{ gross: number }>(sql`
            select coalesce(sum(amount_stars), 0)::int as gross
            from telegram_star_payments
            where paid_at >= ${fromIso}::timestamptz and paid_at < ${nowIso}::timestamptz
          `)
        : Promise.resolve([{ gross: 0 }]),
    ]);

    const userCounts = userRows[0];
    const sessionCounts = sessionRows[0];
    const quality = qualityRows[0];
    const followUp = followUpRows[0];
    const retention = retentionRows[0];
    const features = featureRows[0];
    const dailyDelivery = dailyDeliveryRows[0];
    const followUpDelivery = followUpDeliveryRows[0];

    return {
      users: {
        total: number(userCounts?.total),
        new: number(userCounts?.new_users),
        active: number(sessionCounts?.active_users),
      },
      sessions: {
        started: number(sessionCounts?.started),
        completed: number(sessionCounts?.completed),
        abandoned: number(sessionCounts?.abandoned),
      },
      funnel: {
        assigned: number(sessionCounts?.assigned),
        started: number(sessionCounts?.started),
        baselineRecorded: number(sessionCounts?.baseline_recorded),
        completed: number(sessionCounts?.completed),
        followedUp: number(sessionCounts?.followed_up),
        droppedBeforeBaseline: Math.max(
          0,
          number(sessionCounts?.assigned) - number(sessionCounts?.baseline_recorded),
        ),
        droppedAfterBaseline: Math.max(
          0,
          number(sessionCounts?.baseline_recorded) - number(sessionCounts?.completed),
        ),
      },
      wakeQuality: {
        pairedSessions: number(quality?.paired_sessions),
        averageDelta: rounded(quality?.average_delta),
        improvedSessions: number(quality?.improved_sessions),
      },
      followUp: {
        eligible: number(followUp?.eligible),
        answered: number(followUp?.answered),
        up: number(followUp?.up),
        back: number(followUp?.back),
        drowsy: number(followUp?.drowsy),
      },
      retention: {
        d1Eligible: number(retention?.d1_eligible),
        d1Retained: number(retention?.d1_retained),
        d3Eligible: number(retention?.d3_eligible),
        d3Retained: number(retention?.d3_retained),
        d7Eligible: number(retention?.d7_eligible),
        d7Retained: number(retention?.d7_retained),
        secondSessionWithin7Days: {
          cohort: number(secondSessionRows[0]?.cohort),
          eligible: number(secondSessionRows[0]?.eligible),
          returned: number(secondSessionRows[0]?.returned),
          pending: number(secondSessionRows[0]?.pending),
        },
      },
      timeline: timelineRows.map((row) => ({
        date: row.date,
        newUsers: number(row.new_users),
        startedSessions: number(row.started_sessions),
        completedSessions: number(row.completed_sessions),
      })),
      breakdowns: {
        contexts: contextRows.map((row) => ({
          key: row.key as WakeContext | "unspecified",
          sessions: number(row.sessions),
          completed: number(row.completed),
        })),
        durations: durationRows.map((row) => ({
          minutes: number(row.minutes) as WakeDurationMinutes,
          sessions: number(row.sessions),
          completed: number(row.completed),
        })),
        experiments: experimentRows.map((row) => ({
          version: row.version,
          assigned: number(row.assigned),
          completed: number(row.completed),
        })),
        proInterest: {
          responses: number(proInterestRows[0]?.responses),
          interested: number(proInterestRows[0]?.interested),
          notNow: number(proInterestRows[0]?.not_now),
          notInterested: number(proInterestRows[0]?.not_interested),
          longHistory: number(proInterestRows[0]?.long_history),
          deeperExperiments: number(proInterestRows[0]?.deeper_experiments),
          both: number(proInterestRows[0]?.both),
        },
      },
      features: {
        capabilityProfiles: number(features?.capability_profiles),
        routinesEnabled: number(features?.routines_enabled),
        routineRuns: number(features?.routine_runs),
        routineRunsCompleted: number(features?.routine_runs_completed),
        aiInsightsGenerated: number(features?.ai_insights_generated),
      },
      deliveries: {
        dailySent: number(dailyDelivery?.sent),
        followUpSent: number(followUpDelivery?.sent),
        failed: number(dailyDelivery?.failed) + number(followUpDelivery?.failed),
        blocked: number(dailyDelivery?.blocked) + number(followUpDelivery?.blocked),
      },
      billing: {
        activeSubscriptions: number(billingRows[0]?.active),
        grossStars: number(revenueRows[0]?.gross),
      },
    };
  }
}
