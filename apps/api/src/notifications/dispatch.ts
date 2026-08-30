import type { WakeNotificationRepository } from "@awc/domain";
import type { TelegramNotificationGateway } from "./telegram.js";

export interface DispatchSummary {
  claimed: number;
  sent: number;
  retryWait: number;
  blocked: number;
  failed: number;
}

export type DispatchEvent = {
  event:
    | "notification.sent"
    | "notification.retry_wait"
    | "notification.blocked"
    | "notification.failed";
  deliveryId: string;
};

export async function dispatchWakeNotifications(
  repository: WakeNotificationRepository,
  gateway: TelegramNotificationGateway,
  options: {
    now?: Date;
    limit?: number;
    concurrency?: number;
    onEvent?: (event: DispatchEvent) => void;
  } = {},
): Promise<DispatchSummary> {
  const now = options.now ?? new Date();
  const notifications = await repository.claimDue(now, options.limit ?? 100);
  const summary: DispatchSummary = {
    claimed: notifications.length,
    sent: 0,
    retryWait: 0,
    blocked: 0,
    failed: 0,
  };
  let cursor = 0;
  const processNext = async (): Promise<void> => {
    while (cursor < notifications.length) {
      const notification = notifications[cursor++];
      if (!notification) return;
      try {
        const result = await gateway.send({
          chatId: notification.telegramChatId,
          attempt: notification.attempt,
          now: new Date(),
        });
        await repository.complete(notification.deliveryId, result, new Date());
        if (result.status === "sent") summary.sent += 1;
        else if (result.status === "retry_wait") summary.retryWait += 1;
        else if (result.status === "blocked") summary.blocked += 1;
        else summary.failed += 1;
        options.onEvent?.({
          event: `notification.${result.status === "ambiguous" ? "failed" : result.status}`,
          deliveryId: notification.deliveryId,
        });
      } catch {
        summary.failed += 1;
        options.onEvent?.({ event: "notification.failed", deliveryId: notification.deliveryId });
      }
    }
  };
  const concurrency = Math.max(
    1,
    Math.min(notifications.length, Math.floor(options.concurrency ?? 1)),
  );
  await Promise.all(Array.from({ length: concurrency }, processNext));
  return summary;
}
