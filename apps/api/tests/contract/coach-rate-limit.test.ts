import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsProfile, CoachInsightRepository } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

describe("Coach rate limit", () => {
  const apps: Awaited<ReturnType<typeof createApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("rejects excess requests before recomputing analytics or calling the provider", async () => {
    const profile: AnalyticsProfile = {
      methodVersion: "analytics-v1",
      computedAt: testNow.toISOString(),
      averageDelta: {
        key: "average-delta",
        value: 3,
        evidenceCount: 3,
        evidenceIds: ["one", "two", "three"],
        confidence: "low",
      },
      riseSuccess: {
        key: "rise-success",
        value: 1,
        evidenceCount: 3,
        evidenceIds: ["one", "two", "three"],
        confidence: "low",
      },
      protocolEffects: [],
      factorEffects: [],
      sequenceEffects: [],
    };
    const recompute = vi.fn(async () => profile);
    const generate = vi.fn(async () => ({
      summary: "Наблюдение подтверждено несколькими сессиями.",
      nextExperiment: "Повторить безопасный протокол.",
      caveat: "Выборка пока небольшая.",
      model: "test-coach",
    }));
    let cached: Awaited<ReturnType<CoachInsightRepository["findByUserId"]>> = null;
    const cache: CoachInsightRepository = {
      findByUserId: async () => cached,
      save: async (record) => {
        cached = record;
        return record;
      },
    };
    const app = await createApp(
      { ...testConfig, coachRateLimitMax: 2 },
      {
        ...createMemoryDependencies(),
        analyticsRepository: { recompute },
        coachInsightRepository: cache,
        coachGateway: { generate },
        now: () => testNow,
      },
    );
    apps.push(app);
    const cookie = await authenticateTestUser(app);
    const request = () =>
      app.inject({ method: "POST", url: "/api/v1/coach/insight", headers: { cookie } });

    expect((await request()).statusCode).toBe(200);
    expect((await request()).statusCode).toBe(200);
    const limited = await request();

    expect(limited.statusCode).toBe(429);
    expect(recompute).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenCalledOnce();
  });
});
