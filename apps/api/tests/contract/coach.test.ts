import { describe, expect, it } from "vitest";

import type { AnalyticsProfile, CoachInsightRepository } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

describe("coach insight contract", () => {
  it("requires auth and returns insufficient without provider", async () => {
    const dependencies = createMemoryDependencies();
    const profile: AnalyticsProfile = {
      methodVersion: "analytics-v1",
      computedAt: testNow.toISOString(),
      averageDelta: {
        key: "average-delta",
        value: 2,
        evidenceCount: 2,
        evidenceIds: ["one", "two"],
        confidence: "insufficient",
      },
      riseSuccess: {
        key: "rise-success",
        value: null,
        evidenceCount: 0,
        evidenceIds: [],
        confidence: "insufficient",
      },
      protocolEffects: [],
      factorEffects: [],
    };
    const cache: CoachInsightRepository = {
      findByUserId: async () => null,
      save: async (record) => record,
    };
    const app = await createApp(testConfig, {
      ...dependencies,
      analyticsRepository: { recompute: async () => profile },
      coachInsightRepository: cache,
      coachGateway: null,
      now: () => testNow,
    });
    expect((await app.inject({ method: "POST", url: "/api/v1/coach/insight" })).statusCode).toBe(
      401,
    );
    const cookie = await authenticateTestUser(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/coach/insight",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      source: "fallback",
      limitReached: false,
      refreshAvailableAt: expect.any(String),
    });
    expect(response.json()).toMatchObject({
      status: "insufficient",
      evidenceCount: 2,
      cached: false,
      insight: {
        confidence: "insufficient",
        nextExperiment: expect.any(String),
      },
    });
    await app.close();
  });
});
