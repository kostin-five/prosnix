import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app/create-app.js";
import { createMemoryDependencies, testConfig } from "../helpers.js";

describe("health boundaries", () => {
  const apps: Awaited<ReturnType<typeof createApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("separates liveness from successful dependency readiness", async () => {
    const readinessCheck = vi.fn(async () => undefined);
    const app = await createApp(testConfig, {
      ...createMemoryDependencies(),
      readinessCheck,
    });
    apps.push(app);

    const live = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });

    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: "ok" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ready" });
    expect(readinessCheck).toHaveBeenCalledOnce();
  });

  it("returns a bounded neutral response when the dependency is unavailable", async () => {
    const app = await createApp(
      { ...testConfig, readinessTimeoutMs: 20 },
      {
        ...createMemoryDependencies(),
        readinessCheck: async () => {
          throw new Error("postgres://secret@private-host/database");
        },
      },
    );
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: "service_unavailable" });
    expect(response.json()).toHaveProperty("requestId");
    expect(response.body).not.toContain("postgres");
    expect(response.body).not.toContain("private-host");
  });

  it("times out a readiness check that never settles", async () => {
    const app = await createApp(
      { ...testConfig, readinessTimeoutMs: 20 },
      {
        ...createMemoryDependencies(),
        readinessCheck: () => new Promise<void>(() => undefined),
      },
    );
    apps.push(app);

    const startedAt = Date.now();
    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(Date.now() - startedAt).toBeLessThan(500);
  });
});
