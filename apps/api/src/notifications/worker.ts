import type { WakeNotificationRepository } from "@awc/domain";
import { dispatchWakeNotifications } from "./dispatch.js";
import type { TelegramNotificationGateway } from "./telegram.js";

export async function runNotificationWorker(
  repository: WakeNotificationRepository,
  gateway: TelegramNotificationGateway,
): Promise<void> {
  const summary = await dispatchWakeNotifications(repository, gateway, {
    onEvent: (event) => console.info(JSON.stringify(event)),
  });
  console.info(JSON.stringify({ event: "notification.run.completed", ...summary }));
}
