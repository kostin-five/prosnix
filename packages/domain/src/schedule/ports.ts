import type { WakeScheduleValue } from "./schedule.js";

export interface WakeScheduleRepository {
  findByUserId(userId: string): Promise<WakeScheduleValue | null>;
  save(input: {
    userId: string;
    localTime: string;
    timezone: string;
    enabled: boolean;
    nextTriggerAt: Date | null;
    now: Date;
  }): Promise<WakeScheduleValue>;
  snooze(
    userId: string,
    operationId: string,
    nextTriggerAt: Date,
    now: Date,
  ): Promise<WakeScheduleSnoozeResult>;
}

export type WakeScheduleSnoozeResult =
  | { status: "applied"; schedule: WakeScheduleValue }
  | { status: "replayed"; schedule: WakeScheduleValue }
  | { status: "not_enabled" }
  | { status: "idempotency_conflict" };

export interface ClaimedWakeNotification {
  deliveryId: string;
  userId: string;
  telegramChatId: bigint;
  scheduledFor: Date;
  attempt: number;
}

export interface ClaimedFollowUpNotification {
  deliveryId: string;
  sessionId: string;
  userId: string;
  telegramChatId: bigint;
  scheduledFor: Date;
  attempt: number;
}

export interface NotificationClaimBatch<T> {
  notifications: T[];
  skipped: number;
  maxLagMs: number;
}

export type NotificationResult =
  | { status: "sent"; telegramMessageId: bigint; sentAt: Date }
  | { status: "retry_wait"; retryAt: Date; errorCode: "rate_limited" }
  | { status: "blocked"; errorCode: "bot_blocked" }
  | { status: "ambiguous"; errorCode: "network" | "telegram_5xx" | "invalid_response" }
  | { status: "failed"; errorCode: "telegram_4xx" };

export interface WakeNotificationRepository {
  claimDue(now: Date, limit: number): Promise<NotificationClaimBatch<ClaimedWakeNotification>>;
  complete(deliveryId: string, result: NotificationResult, now: Date): Promise<void>;
}

export interface FollowUpNotificationRepository {
  claimDue(now: Date, limit: number): Promise<NotificationClaimBatch<ClaimedFollowUpNotification>>;
  prepareToSend(deliveryId: string, now: Date): Promise<boolean>;
  complete(deliveryId: string, result: NotificationResult, now: Date): Promise<void>;
}

export interface NotificationMaintenanceRepository {
  pruneBefore(cutoff: Date): Promise<{ wakeDeleted: number; followUpDeleted: number }>;
}
