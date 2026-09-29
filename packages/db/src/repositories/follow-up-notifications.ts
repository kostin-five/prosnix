import { and, asc, eq, isNull, lte, ne, or } from "drizzle-orm";

import type {
  ClaimedFollowUpNotification,
  FollowUpNotificationRepository,
  NotificationResult,
} from "@awc/domain";
import {
  followUpNotificationDeliveries,
  followUpObservations,
  users,
  wakeSchedules,
  wakeSessions,
} from "../schema.js";
import type { Database } from "./types.js";

const MAX_FOLLOW_UP_LAG_MS = 60 * 60_000;

export class PostgresFollowUpNotificationRepository implements FollowUpNotificationRepository {
  constructor(private readonly db: Database) {}

  async findSentMessage(userId: string, sessionId: string, messageId: bigint): Promise<boolean> {
    const [delivery] = await this.db
      .select({ id: followUpNotificationDeliveries.id })
      .from(followUpNotificationDeliveries)
      .where(
        and(
          eq(followUpNotificationDeliveries.userId, userId),
          eq(followUpNotificationDeliveries.sessionId, sessionId),
          eq(followUpNotificationDeliveries.telegramMessageId, messageId),
          eq(followUpNotificationDeliveries.status, "sent"),
        ),
      )
      .limit(1);
    return Boolean(delivery);
  }

  async claimDue(now: Date, limit: number) {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      const claimed: ClaimedFollowUpNotification[] = [];
      let skipped = 0;
      let maxLagMs = 0;
      const dueSessions = await db
        .select({
          sessionId: wakeSessions.id,
          userId: wakeSessions.userId,
          scheduledFor: wakeSessions.followUpDueAt,
          telegramChatId: users.telegramUserId,
        })
        .from(wakeSessions)
        .innerJoin(users, eq(users.id, wakeSessions.userId))
        .leftJoin(followUpObservations, eq(followUpObservations.sessionId, wakeSessions.id))
        .leftJoin(
          followUpNotificationDeliveries,
          eq(followUpNotificationDeliveries.sessionId, wakeSessions.id),
        )
        .leftJoin(wakeSchedules, eq(wakeSchedules.userId, wakeSessions.userId))
        .where(
          and(
            or(
              eq(wakeSessions.status, "protocol_completed"),
              and(eq(wakeSessions.status, "abandoned"), eq(wakeSessions.sessionKind, "recovery")),
            ),
            lte(wakeSessions.followUpDueAt, now),
            isNull(followUpObservations.id),
            isNull(followUpNotificationDeliveries.id),
            or(isNull(wakeSchedules.botStatus), ne(wakeSchedules.botStatus, "blocked")),
          ),
        )
        .orderBy(asc(wakeSessions.followUpDueAt))
        .limit(limit);

      for (const due of dueSessions) {
        if (!due.scheduledFor) continue;
        const lagMs = Math.max(0, now.getTime() - due.scheduledFor.getTime());
        maxLagMs = Math.max(maxLagMs, lagMs);
        const late = lagMs > MAX_FOLLOW_UP_LAG_MS;
        const [delivery] = await db
          .insert(followUpNotificationDeliveries)
          .values({
            sessionId: due.sessionId,
            userId: due.userId,
            scheduledFor: due.scheduledFor,
            status: late ? "skipped" : "sending",
            errorCode: late ? "late_window" : null,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .returning({ id: followUpNotificationDeliveries.id });
        if (!delivery) continue;
        if (late) {
          skipped += 1;
        } else {
          claimed.push({
            deliveryId: delivery.id,
            sessionId: due.sessionId,
            userId: due.userId,
            telegramChatId: due.telegramChatId,
            scheduledFor: due.scheduledFor,
            attempt: 1,
          });
        }
      }

      const remaining = Math.max(0, limit - claimed.length);
      if (remaining === 0) return { notifications: claimed, skipped, maxLagMs };
      const retries = await db
        .select({
          id: followUpNotificationDeliveries.id,
          sessionId: followUpNotificationDeliveries.sessionId,
          userId: followUpNotificationDeliveries.userId,
          scheduledFor: followUpNotificationDeliveries.scheduledFor,
          attempts: followUpNotificationDeliveries.attempts,
          retryAt: followUpNotificationDeliveries.retryAt,
          telegramChatId: users.telegramUserId,
        })
        .from(followUpNotificationDeliveries)
        .innerJoin(users, eq(users.id, followUpNotificationDeliveries.userId))
        .where(
          and(
            eq(followUpNotificationDeliveries.status, "retry_wait"),
            lte(followUpNotificationDeliveries.retryAt, now),
          ),
        )
        .orderBy(asc(followUpNotificationDeliveries.retryAt))
        .limit(remaining);

      for (const retry of retries) {
        if (!retry.retryAt || retry.attempts >= 2) continue;
        maxLagMs = Math.max(maxLagMs, now.getTime() - retry.scheduledFor.getTime());
        const updated = await db
          .update(followUpNotificationDeliveries)
          .set({
            status: "sending",
            attempts: retry.attempts + 1,
            retryAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(followUpNotificationDeliveries.id, retry.id),
              eq(followUpNotificationDeliveries.status, "retry_wait"),
              eq(followUpNotificationDeliveries.retryAt, retry.retryAt),
            ),
          )
          .returning({ id: followUpNotificationDeliveries.id });
        if (updated.length > 0) {
          claimed.push({
            deliveryId: retry.id,
            sessionId: retry.sessionId,
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

  async prepareToSend(deliveryId: string, now: Date): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      const [delivery] = await db
        .select({
          id: followUpNotificationDeliveries.id,
          observationId: followUpObservations.id,
        })
        .from(followUpNotificationDeliveries)
        .leftJoin(
          followUpObservations,
          eq(followUpObservations.sessionId, followUpNotificationDeliveries.sessionId),
        )
        .where(
          and(
            eq(followUpNotificationDeliveries.id, deliveryId),
            eq(followUpNotificationDeliveries.status, "sending"),
          ),
        )
        .limit(1);
      if (!delivery) return false;
      if (!delivery.observationId) return true;
      await db
        .update(followUpNotificationDeliveries)
        .set({ status: "skipped", errorCode: "answered_before_send", updatedAt: now })
        .where(
          and(
            eq(followUpNotificationDeliveries.id, deliveryId),
            eq(followUpNotificationDeliveries.status, "sending"),
          ),
        );
      return false;
    });
  }

  async complete(deliveryId: string, result: NotificationResult, now: Date): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      const [delivery] = await db
        .update(followUpNotificationDeliveries)
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
            eq(followUpNotificationDeliveries.id, deliveryId),
            eq(followUpNotificationDeliveries.status, "sending"),
          ),
        )
        .returning({ userId: followUpNotificationDeliveries.userId });
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
