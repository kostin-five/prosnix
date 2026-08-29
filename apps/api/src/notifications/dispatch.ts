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
  options: { now?: Date; limit?: number; onEvent?: (event: DispatchEvent) => void } = {},
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
  for (const notification of notifications) {
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
  return summary;
}
