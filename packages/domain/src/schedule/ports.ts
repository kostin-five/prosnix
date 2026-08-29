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
}

export interface ClaimedWakeNotification {
  deliveryId: string;
  userId: string;
  telegramChatId: bigint;
  scheduledFor: Date;
  attempt: number;
}

export type NotificationResult =
  | { status: "sent"; telegramMessageId: bigint; sentAt: Date }
  | { status: "retry_wait"; retryAt: Date; errorCode: "rate_limited" }
  | { status: "blocked"; errorCode: "bot_blocked" }
  | { status: "ambiguous"; errorCode: "network" | "telegram_5xx" | "invalid_response" }
  | { status: "failed"; errorCode: "telegram_4xx" };

export interface WakeNotificationRepository {
  claimDue(now: Date, limit: number): Promise<ClaimedWakeNotification[]>;
  complete(deliveryId: string, result: NotificationResult, now: Date): Promise<void>;
}
