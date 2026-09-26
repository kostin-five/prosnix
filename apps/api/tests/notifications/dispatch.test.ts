import { describe, expect, it, vi } from "vitest";

import type { ClaimedWakeNotification, WakeNotificationRepository } from "@awc/domain";
import { dispatchWakeNotifications } from "../../src/notifications/dispatch.js";

describe("notification dispatcher", () => {
  it("передаёт жизненную цель только в выбранное утреннее уведомление", async () => {
    const notification: ClaimedWakeNotification = {
      deliveryId: "goal-delivery",
      userId: "goal-owner",
      telegramChatId: 42n,
      lifeGoal: "Построить своё дело",
      scheduledFor: new Date("2026-09-26T06:00:00Z"),
      attempt: 1,
    };
    const gateway = {
      send: vi.fn(async () => ({
        status: "sent" as const,
        telegramMessageId: 1n,
        sentAt: new Date("2026-09-26T06:00:01Z"),
      })),
    };
    await dispatchWakeNotifications(
      {
        claimDue: async () => ({ notifications: [notification], skipped: 0, maxLagMs: 0 }),
        complete: async () => undefined,
      },
      gateway,
    );
    expect(gateway.send).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 42n, lifeGoal: notification.lifeGoal }),
    );
  });

  it("respects the configured concurrency while completing the whole claimed batch", async () => {
    const notifications: ClaimedWakeNotification[] = Array.from({ length: 10 }, (_, index) => ({
      deliveryId: `delivery-${index}`,
      userId: `user-${index}`,
      telegramChatId: BigInt(index + 1),
      scheduledFor: new Date("2026-08-30T06:00:00.000Z"),
      attempt: 1,
    }));
    const repository: WakeNotificationRepository = {
      claimDue: vi.fn(async () => ({ notifications, skipped: 2, maxLagMs: 4_000 })),
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
    expect(summary).toMatchObject({
      claimed: 10,
      sent: 10,
      failed: 0,
      skipped: 2,
      maxLagMs: 4_000,
    });
    expect(gateway.send).toHaveBeenCalledWith(expect.objectContaining({ kind: "wake" }));
    expect(repository.complete).toHaveBeenCalledTimes(10);
  });
});
