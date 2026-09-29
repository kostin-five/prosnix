import type { FollowUpNotificationRepository } from "@awc/domain";
import type { DispatchEvent, DispatchSummary } from "./dispatch.js";
import type { TelegramNotificationGateway } from "./telegram.js";

export async function dispatchFollowUpNotifications(
  repository: FollowUpNotificationRepository,
  gateway: TelegramNotificationGateway,
  options: {
    now?: Date;
    limit?: number;
    concurrency?: number;
    onEvent?: (event: DispatchEvent) => void;
  } = {},
): Promise<DispatchSummary> {
  const now = options.now ?? new Date();
  const batch = await repository.claimDue(now, options.limit ?? 100);
  const notifications = batch.notifications;
  const summary: DispatchSummary = {
    claimed: notifications.length,
    sent: 0,
    retryWait: 0,
    blocked: 0,
    failed: 0,
    skipped: batch.skipped,
    maxLagMs: batch.maxLagMs,
  };
  let cursor = 0;
  const processNext = async (): Promise<void> => {
    while (cursor < notifications.length) {
      const notification = notifications[cursor++];
      if (!notification) return;
      try {
        if (!(await repository.prepareToSend(notification.deliveryId, new Date()))) {
          summary.skipped += 1;
          options.onEvent?.({
            kind: "follow_up",
            event: "notification.skipped",
            deliveryId: notification.deliveryId,
          });
          continue;
        }
        const result = await gateway.send({
          kind: "follow_up",
          chatId: notification.telegramChatId,
          sessionId: notification.sessionId,
          attempt: notification.attempt,
          now: new Date(),
        });
        await repository.complete(notification.deliveryId, result, new Date());
        if (result.status === "sent") summary.sent += 1;
        else if (result.status === "retry_wait") summary.retryWait += 1;
        else if (result.status === "blocked") summary.blocked += 1;
        else summary.failed += 1;
        options.onEvent?.({
          kind: "follow_up",
          event: `notification.${result.status === "ambiguous" ? "failed" : result.status}`,
          deliveryId: notification.deliveryId,
        });
      } catch {
        summary.failed += 1;
        options.onEvent?.({
          kind: "follow_up",
          event: "notification.failed",
          deliveryId: notification.deliveryId,
        });
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
