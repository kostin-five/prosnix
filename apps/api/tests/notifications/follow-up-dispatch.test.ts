import { describe, expect, it, vi } from "vitest";

import type { FollowUpNotificationRepository } from "@awc/domain";
import { dispatchFollowUpNotifications } from "../../src/notifications/follow-up-dispatch.js";

const claimed = {
  deliveryId: "delivery-1",
  sessionId: "session-1",
  userId: "user-1",
  telegramChatId: 42n,
  scheduledFor: new Date("2026-08-30T06:00:00Z"),
  attempt: 1,
};

function repository(prepare = true): FollowUpNotificationRepository {
  return {
    claimDue: vi.fn(async () => ({ notifications: [claimed], skipped: 1, maxLagMs: 3_000 })),
    prepareToSend: vi.fn(async () => prepare),
    complete: vi.fn(async () => undefined),
  };
}

describe("follow-up notification dispatcher", () => {
  it("sends a claimed notification with follow-up kind", async () => {
    const storage = repository();
    const gateway = {
      send: vi.fn(async () => ({
        status: "sent" as const,
        telegramMessageId: 10n,
        sentAt: new Date(),
      })),
    };
    const summary = await dispatchFollowUpNotifications(storage, gateway);
    expect(summary).toMatchObject({ claimed: 1, sent: 1, skipped: 1, maxLagMs: 3_000 });
    expect(gateway.send).toHaveBeenCalledWith(expect.objectContaining({ kind: "follow_up" }));
    expect(storage.complete).toHaveBeenCalledTimes(1);
  });

  it("skips the send when the user answered after claim", async () => {
    const storage = repository(false);
    const gateway = { send: vi.fn() };
    const summary = await dispatchFollowUpNotifications(storage, gateway);
    expect(summary).toMatchObject({ claimed: 1, sent: 0, skipped: 2 });
    expect(gateway.send).not.toHaveBeenCalled();
    expect(storage.complete).not.toHaveBeenCalled();
  });

  it("continues after an individual gateway failure", async () => {
    const second = { ...claimed, deliveryId: "delivery-2", sessionId: "session-2" };
    const storage = repository();
    vi.mocked(storage.claimDue).mockResolvedValue({
      notifications: [claimed, second],
      skipped: 0,
      maxLagMs: 0,
    });
    const gateway = {
      send: vi
        .fn()
        .mockRejectedValueOnce(new Error("transport"))
        .mockResolvedValueOnce({ status: "sent", telegramMessageId: 11n, sentAt: new Date() }),
    };
    const summary = await dispatchFollowUpNotifications(storage, gateway, { concurrency: 1 });
    expect(summary).toMatchObject({ claimed: 2, sent: 1, failed: 1 });
  });
});
