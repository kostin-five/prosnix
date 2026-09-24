import { describe, expect, it } from "vitest";

import type { AnalyticsProfile } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

const profile: AnalyticsProfile = {
  methodVersion: "analytics-v1",
  computedAt: testNow.toISOString(),
  averageDelta: {
    key: "average-delta",
    value: 3.5,
    evidenceCount: 6,
    evidenceIds: ["s1", "s2", "s3", "s4", "s5", "s6"],
    confidence: "medium",
  },
  riseSuccess: {
    key: "rise-success",
    value: 0.6,
    evidenceCount: 5,
    evidenceIds: ["s1", "s2", "s3", "s4", "s5"],
    confidence: "low",
  },
  protocolEffects: [],
  factorEffects: [
    {
      key: "factor:movement:movement-a",
      value: 3,
      evidenceCount: 3,
      evidenceIds: ["s1", "s2", "s3", "s4", "s5", "s6"],
      confidence: "low",
    },
  ],
  sequenceEffects: [
    {
      key: "sequence:water>memory|context:night_sleep|budget:5m",
      value: 2,
      evidenceCount: 2,
      evidenceIds: ["s1", "s2"],
      confidence: "insufficient",
    },
  ],
};

describe("контракт профиля аналитики", () => {
  it("возвращает версию метода, источники и уверенность только владельцу", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      analyticsRepository: { recompute: async () => profile },
      now: () => testNow,
    });
    const unauthorized = await app.inject({ method: "GET", url: "/api/v1/analytics/profile" });
    expect(unauthorized.statusCode).toBe(401);

    const cookie = await authenticateTestUser(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/profile",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...profile, sequenceEffects: [] });
    await app.close();
  });

  it("возвращает сопоставимые повторы только при включённом пилотном флаге", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(
      { ...testConfig, wakeCombinationAnalyticsEnabled: true },
      {
        ...dependencies,
        analyticsRepository: { recompute: async () => profile },
        now: () => testNow,
      },
    );
    const cookie = await authenticateTestUser(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/profile",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(profile);
    await app.close();
  });
});
