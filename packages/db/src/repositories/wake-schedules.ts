import { and, asc, eq, lte, sql } from "drizzle-orm";

import {
  nextDailyTrigger,
  type ClaimedWakeNotification,
  type NotificationResult,
  type WakeNotificationRepository,
  type WakeScheduleRepository,
  type WakeScheduleValue,
} from "@awc/domain";
import { notificationDeliveries, users, wakeSchedules } from "../schema.js";
import type { Database } from "./types.js";

function mapSchedule(row: typeof wakeSchedules.$inferSelect): WakeScheduleValue {
  return {
    userId: row.userId,
    localTime: row.localTime,
    timezone: row.timezone,
    enabled: row.enabled,
    nextTriggerAt: row.nextTriggerAt,
    botStatus: row.botStatus,
    revision: row.revision,
  };
}

export class PostgresWakeScheduleRepository implements WakeScheduleRepository {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: string): Promise<WakeScheduleValue | null> {
    const [row] = await this.db
      .select()
      .from(wakeSchedules)
      .where(eq(wakeSchedules.userId, userId))
      .limit(1);
    return row ? mapSchedule(row) : null;
  }

  async save(input: Parameters<WakeScheduleRepository["save"]>[0]): Promise<WakeScheduleValue> {
    const [row] = await this.db
      .insert(wakeSchedules)
      .values({
        userId: input.userId,
        localTime: input.localTime,
        timezone: input.timezone,
        enabled: input.enabled,
        nextTriggerAt: input.nextTriggerAt,
        updatedAt: input.now,
      })
      .onConflictDoUpdate({
        target: wakeSchedules.userId,
        set: {
          localTime: input.localTime,
          timezone: input.timezone,
          enabled: input.enabled,
          nextTriggerAt: input.nextTriggerAt,
          revision: sql`${wakeSchedules.revision} + 1`,
          updatedAt: input.now,
        },
      })
      .returning();
    if (!row) throw new Error("Wake schedule upsert did not return a row");
    return mapSchedule(row);
  }
}

export class PostgresWakeNotificationRepository implements WakeNotificationRepository {
  constructor(private readonly db: Database) {}

  async claimDue(now: Date, limit: number) {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      const claimed: ClaimedWakeNotification[] = [];
      let skipped = 0;
      let maxLagMs = 0;
      const dueSchedules = await db
        .select({ schedule: wakeSchedules, telegramChatId: users.telegramUserId })
        .from(wakeSchedules)
        .innerJoin(users, eq(users.id, wakeSchedules.userId))
        .where(and(eq(wakeSchedules.enabled, true), lte(wakeSchedules.nextTriggerAt, now)))
        .orderBy(asc(wakeSchedules.nextTriggerAt))
        .limit(limit);

      for (const due of dueSchedules) {
        if (!due.schedule.nextTriggerAt) continue;
        const scheduledFor = due.schedule.nextTriggerAt;
        maxLagMs = Math.max(maxLagMs, now.getTime() - scheduledFor.getTime());
        const nextTriggerAt = nextDailyTrigger(
          due.schedule.localTime,
          due.schedule.timezone,
          scheduledFor,
        );
        const advanced = await db
          .update(wakeSchedules)
          .set({ nextTriggerAt, updatedAt: now })
          .where(
            and(
              eq(wakeSchedules.userId, due.schedule.userId),
              eq(wakeSchedules.enabled, true),
              eq(wakeSchedules.nextTriggerAt, scheduledFor),
            ),
          )
          .returning({ userId: wakeSchedules.userId });
        if (advanced.length === 0) continue;

        const late = now.getTime() - scheduledFor.getTime() > 15 * 60_000;
        const [delivery] = await db
          .insert(notificationDeliveries)
          .values({
            scheduleUserId: due.schedule.userId,
            scheduledFor,
            status: late ? "skipped" : "sending",
            errorCode: late ? "late_window" : null,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .returning({ id: notificationDeliveries.id });
        if (delivery && !late) {
          claimed.push({
            deliveryId: delivery.id,
            userId: due.schedule.userId,
            telegramChatId: due.telegramChatId,
            scheduledFor,
            attempt: 1,
          });
        } else if (delivery && late) {
          skipped += 1;
        }
      }

      const remaining = Math.max(0, limit - claimed.length);
      if (remaining === 0) return { notifications: claimed, skipped, maxLagMs };
      const retries = await db
        .select({
          id: notificationDeliveries.id,
          userId: notificationDeliveries.scheduleUserId,
          scheduledFor: notificationDeliveries.scheduledFor,
          attempts: notificationDeliveries.attempts,
          retryAt: notificationDeliveries.retryAt,
          telegramChatId: users.telegramUserId,
        })
        .from(notificationDeliveries)
        .innerJoin(users, eq(users.id, notificationDeliveries.scheduleUserId))
        .where(
          and(
            eq(notificationDeliveries.status, "retry_wait"),
            lte(notificationDeliveries.retryAt, now),
          ),
        )
        .orderBy(asc(notificationDeliveries.retryAt))
        .limit(remaining);

      for (const retry of retries) {
        if (!retry.retryAt || retry.attempts >= 2) continue;
        maxLagMs = Math.max(maxLagMs, now.getTime() - retry.scheduledFor.getTime());
        const updated = await db
          .update(notificationDeliveries)
          .set({
            status: "sending",
            attempts: retry.attempts + 1,
            retryAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(notificationDeliveries.id, retry.id),
              eq(notificationDeliveries.status, "retry_wait"),
              eq(notificationDeliveries.retryAt, retry.retryAt),
            ),
          )
          .returning({ id: notificationDeliveries.id });
        if (updated.length > 0) {
          claimed.push({
            deliveryId: retry.id,
            userId: retry.userId,
            telegramChatId: retry.telegramChatId,
            scheduledFor: retry.scheduledFor,
            attempt: retry.attempts + 1,
          });
        }
      }
      return { notifications: claimed, skipped, maxLagMs };
    });
  }

  async complete(deliveryId: string, result: NotificationResult, now: Date): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      const [delivery] = await db
        .update(notificationDeliveries)
        .set({
          status: result.status,
          retryAt: result.status === "retry_wait" ? result.retryAt : null,
          telegramMessageId: result.status === "sent" ? result.telegramMessageId : null,
          sentAt: result.status === "sent" ? result.sentAt : null,
          errorCode: result.status === "sent" ? null : result.errorCode,
          updatedAt: now,
        })
        .where(
          and(
            eq(notificationDeliveries.id, deliveryId),
            eq(notificationDeliveries.status, "sending"),
          ),
        )
        .returning({ userId: notificationDeliveries.scheduleUserId });
      if (!delivery) return;
      if (result.status === "sent") {
        await db
          .update(wakeSchedules)
          .set({ botStatus: "available", updatedAt: now })
          .where(eq(wakeSchedules.userId, delivery.userId));
      } else if (result.status === "blocked") {
        await db
          .update(wakeSchedules)
          .set({ botStatus: "blocked", enabled: false, nextTriggerAt: null, updatedAt: now })
          .where(eq(wakeSchedules.userId, delivery.userId));
      }
    });
  }
}
