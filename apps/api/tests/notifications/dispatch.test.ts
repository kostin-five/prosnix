import { describe, expect, it, vi } from "vitest";

import type { ClaimedWakeNotification, WakeNotificationRepository } from "@awc/domain";
import { dispatchWakeNotifications } from "../../src/notifications/dispatch.js";

describe("notification dispatcher", () => {
  it("respects the configured concurrency while completing the whole claimed batch", async () => {
    const notifications: ClaimedWakeNotification[] = Array.from({ length: 10 }, (_, index) => ({
      deliveryId: `delivery-${index}`,
      userId: `user-${index}`,
      telegramChatId: BigInt(index + 1),
      scheduledFor: new Date("2026-08-30T06:00:00.000Z"),
      attempt: 1,
    }));
    const repository: WakeNotificationRepository = {
      claimDue: vi.fn(async () => notifications),
      complete: vi.fn(async () => undefined),
    };
    let active = 0;
    let maximumActive = 0;
    const gateway = {
      send: vi.fn(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return {
          status: "sent" as const,
          telegramMessageId: 1n,
          sentAt: new Date("2026-08-30T06:00:01.000Z"),
        };
      }),
    };

    const summary = await dispatchWakeNotifications(repository, gateway, {
      now: new Date("2026-08-30T06:00:00.000Z"),
      limit: 10,
      concurrency: 5,
    });

    expect(maximumActive).toBe(5);
    expect(summary).toMatchObject({ claimed: 10, sent: 10, failed: 0 });
    expect(repository.complete).toHaveBeenCalledTimes(10);
  });
});
