import { describe, expect, it, vi } from "vitest";

import type { WakeNotificationRepository } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { createMemoryDependencies, testConfig, testNow } from "../helpers.js";

function createNotificationRepository(): WakeNotificationRepository {
  return {
    claimDue: vi.fn(async () => ({
      notifications: [
        {
          deliveryId: "00000000-0000-4000-8000-000000000201",
          userId: "00000000-0000-4000-8000-000000000042",
          telegramChatId: 42n,
          scheduledFor: testNow,
          attempt: 1,
        },
      ],
      skipped: 0,
      maxLagMs: 0,
    })),
    complete: vi.fn(async () => undefined),
  };
}

describe("internal notification dispatch contract", () => {
  it("rejects missing and incorrect Bearer secrets", async () => {
    const repository = createNotificationRepository();
    const gateway = { send: vi.fn() };
    const app = await createApp(testConfig, {
      ...createMemoryDependencies(),
      wakeNotificationRepository: repository,
      notificationGateway: gateway,
    });

    for (const authorization of [undefined, "Bearer wrong-secret"]) {
      const response = await app.inject({
        method: "POST",
        url: "/internal/notifications/dispatch",
        ...(authorization ? { headers: { authorization } } : {}),
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "unauthorized" });
    }
    expect(repository.claimDue).not.toHaveBeenCalled();
    expect(gateway.send).not.toHaveBeenCalled();
    await app.close();
  });

  it("dispatches a bounded batch with the correct secret", async () => {
    const repository = createNotificationRepository();
    const gateway = {
      send: vi.fn(async () => ({
        status: "sent" as const,
        telegramMessageId: 12n,
        sentAt: testNow,
      })),
    };
    const app = await createApp(testConfig, {
      ...createMemoryDependencies(),
      now: () => testNow,
      wakeNotificationRepository: repository,
      notificationGateway: gateway,
    });
    const response = await app.inject({
      method: "POST",
      url: "/internal/notifications/dispatch",
      headers: { authorization: `Bearer ${testConfig.cronSecret}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({
      wake: { claimed: 1, sent: 1, failed: 0 },
      followUp: { claimed: 0, sent: 0 },
      total: { claimed: 1, sent: 1, failed: 0 },
      maintenance: { wakeDeleted: 0, followUpDeleted: 0 },
      maxLagMs: 0,
    });
    expect(response.json().durationMs).toEqual(expect.any(Number));
    expect(repository.claimDue).toHaveBeenCalledWith(testNow, 10);
    expect(repository.complete).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("rejects an overlapping run in the same process", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const repository = createNotificationRepository();
    vi.mocked(repository.claimDue).mockImplementationOnce(async () => {
      await blocked;
      return { notifications: [], skipped: 0, maxLagMs: 0 };
    });
    const app = await createApp(testConfig, {
      ...createMemoryDependencies(),
      wakeNotificationRepository: repository,
      notificationGateway: { send: vi.fn() },
    });
    const first = app.inject({
      method: "POST",
      url: "/internal/notifications/dispatch",
      headers: { authorization: `Bearer ${testConfig.cronSecret}` },
    });
    await vi.waitFor(() => expect(repository.claimDue).toHaveBeenCalled());
    const second = await app.inject({
      method: "POST",
      url: "/internal/notifications/dispatch",
      headers: { authorization: `Bearer ${testConfig.cronSecret}` },
    });
    expect(second.statusCode).toBe(409);
    release();
    expect((await first).statusCode).toBe(200);
    await app.close();
  });

  it("stays unavailable until server-side cron settings exist", async () => {
    const app = await createApp(
      { ...testConfig, cronSecret: "" },
      {
        ...createMemoryDependencies(),
        wakeNotificationRepository: createNotificationRepository(),
        notificationGateway: { send: vi.fn() },
      },
    );
    const response = await app.inject({
      method: "POST",
      url: "/internal/notifications/dispatch",
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "notification_dispatch_not_configured" });
    await app.close();
  });
});
