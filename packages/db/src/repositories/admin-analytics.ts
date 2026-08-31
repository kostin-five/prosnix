import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";

import type { AdminGrowthRepository } from "@awc/domain";
import {
  followUpNotificationDeliveries,
  followUpObservations,
  notificationDeliveries,
  subscriptions,
  telegramStarPayments,
  users,
  wakeSessions,
} from "../schema.js";
import type { Database } from "./types.js";

const number = (value: unknown): number => Number(value ?? 0);

export class PostgresAdminGrowthRepository implements AdminGrowthRepository {
  constructor(private readonly db: Database) {}

  async isAllowed(userId: string, telegramUserIds: readonly bigint[]): Promise<boolean> {
    if (telegramUserIds.length === 0) return false;
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), inArray(users.telegramUserId, [...telegramUserIds])))
      .limit(1);
    return Boolean(row);
  }

  async summarize(from: Date, now: Date) {
    const fromIso = from.toISOString();
    const nowIso = now.toISOString();
    const d1CutoffIso = new Date(now.getTime() - 86_400_000).toISOString();
    const d7CutoffIso = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const [userCounts] = await this.db
      .select({
        total: count(users.id),
        newUsers: sql<number>`count(*) filter (where ${users.createdAt} >= ${fromIso}::timestamptz)::int`,
      })
      .from(users);

    const [sessionCounts] = await this.db
      .select({
        activeUsers: sql<number>`count(distinct ${wakeSessions.userId})::int`,
        started: sql<number>`count(*) filter (where ${wakeSessions.startedAt} is not null)::int`,
        completed: sql<number>`count(*) filter (where ${wakeSessions.status} = 'protocol_completed')::int`,
        abandoned: sql<number>`count(*) filter (where ${wakeSessions.status} = 'abandoned')::int`,
      })
      .from(wakeSessions)
      .where(gte(wakeSessions.createdAt, from));

    const [followUpCounts] = await this.db
      .select({
        answered: count(followUpObservations.id),
        up: sql<number>`count(*) filter (where ${followUpObservations.outcome} = 'up')::int`,
        back: sql<number>`count(*) filter (where ${followUpObservations.outcome} = 'back')::int`,
        drowsy: sql<number>`count(*) filter (where ${followUpObservations.outcome} = 'drowsy')::int`,
      })
      .from(followUpObservations)
      .where(gte(followUpObservations.observedAt, from));

    const [retention] = await this.db.execute<{
      d1_eligible: number;
      d1_retained: number;
      d7_eligible: number;
      d7_retained: number;
    }>(sql`
      select
        count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d1CutoffIso}::timestamptz)::int as d1_eligible,
        count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d1CutoffIso}::timestamptz and exists (
          select 1 from wake_sessions s where s.user_id = u.id and s.status = 'protocol_completed'
            and date_trunc('day', s.protocol_completed_at at time zone 'UTC') = date_trunc('day', u.created_at at time zone 'UTC') + interval '1 day'
        ))::int as d1_retained,
        count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d7CutoffIso}::timestamptz)::int as d7_eligible,
        count(*) filter (where u.created_at >= ${fromIso}::timestamptz and u.created_at < ${d7CutoffIso}::timestamptz and exists (
          select 1 from wake_sessions s where s.user_id = u.id and s.status = 'protocol_completed'
            and date_trunc('day', s.protocol_completed_at at time zone 'UTC') = date_trunc('day', u.created_at at time zone 'UTC') + interval '7 days'
        ))::int as d7_retained
      from users u
    `);

    const [dailyDelivery] = await this.db
      .select({
        sent: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'sent')::int`,
        failed: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('failed','ambiguous'))::int`,
        blocked: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'blocked')::int`,
      })
      .from(notificationDeliveries)
      .where(gte(notificationDeliveries.createdAt, from));
    const [followUpDelivery] = await this.db
      .select({
        sent: sql<number>`count(*) filter (where ${followUpNotificationDeliveries.status} = 'sent')::int`,
        failed: sql<number>`count(*) filter (where ${followUpNotificationDeliveries.status} in ('failed','ambiguous'))::int`,
        blocked: sql<number>`count(*) filter (where ${followUpNotificationDeliveries.status} = 'blocked')::int`,
      })
      .from(followUpNotificationDeliveries)
      .where(gte(followUpNotificationDeliveries.createdAt, from));

    const [billing] = await this.db
      .select({
        active: sql<number>`count(*) filter (where ${subscriptions.status} in ('active', 'canceled', 'past_due') and ${subscriptions.currentPeriodEnd} > ${nowIso}::timestamptz)::int`,
      })
      .from(subscriptions);
    const [revenue] = await this.db
      .select({ gross: sql<number>`coalesce(sum(${telegramStarPayments.amountStars}), 0)::int` })
      .from(telegramStarPayments)
      .where(and(gte(telegramStarPayments.paidAt, from), lt(telegramStarPayments.paidAt, now)));

    return {
      users: {
        total: number(userCounts?.total),
        new: number(userCounts?.newUsers),
        active: number(sessionCounts?.activeUsers),
      },
      sessions: {
        started: number(sessionCounts?.started),
        completed: number(sessionCounts?.completed),
        abandoned: number(sessionCounts?.abandoned),
      },
      followUp: {
        answered: number(followUpCounts?.answered),
        up: number(followUpCounts?.up),
        back: number(followUpCounts?.back),
        drowsy: number(followUpCounts?.drowsy),
      },
      retention: {
        d1Eligible: number(retention?.d1_eligible),
        d1Retained: number(retention?.d1_retained),
        d7Eligible: number(retention?.d7_eligible),
        d7Retained: number(retention?.d7_retained),
      },
      deliveries: {
        dailySent: number(dailyDelivery?.sent),
        followUpSent: number(followUpDelivery?.sent),
        failed: number(dailyDelivery?.failed) + number(followUpDelivery?.failed),
        blocked: number(dailyDelivery?.blocked) + number(followUpDelivery?.blocked),
      },
      billing: { activeSubscriptions: number(billing?.active), grossStars: number(revenue?.gross) },
    };
  }
}
