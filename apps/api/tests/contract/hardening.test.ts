import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app/create-app.js";
import {
  authenticateTestUser,
  createMemoryDependencies,
  signedInitData,
  testConfig,
  testNow,
} from "../helpers.js";

describe("HTTP hardening contract", () => {
  const apps: Awaited<ReturnType<typeof createApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("adds security headers and no-store to private API responses", async () => {
    const app = await createApp(testConfig, {
      ...createMemoryDependencies(),
      now: () => testNow,
    });
    apps.push(app);
    const cookie = await authenticateTestUser(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/bootstrap",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("rejects oversized bodies before Telegram signature validation", async () => {
    const app = await createApp(testConfig, createMemoryDependencies());
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/telegram",
      payload: { initData: "x".repeat(40 * 1024) },
    });

    expect(response.statusCode).toBe(413);
  });

  it("rate-limits repeated Telegram authentication attempts", async () => {
    const app = await createApp(
      { ...testConfig, authRateLimitMax: 2 },
      { ...createMemoryDependencies(), now: () => testNow },
    );
    apps.push(app);

    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/api/v1/auth/telegram",
        payload: { initData: signedInitData() },
      });
    expect((await attempt()).statusCode).toBe(204);
    expect((await attempt()).statusCode).toBe(204);
    const limited = await attempt();
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: "rate_limit_exceeded" });
  });
});
