import { describe, expect, it } from "vitest";

import type { AnalyticsProfile, CoachInsightRepository } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

describe("coach insight contract", () => {
  it("requires auth and asks for confirmation without calling provider", async () => {
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
      payload: { confirmEarly: false },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      source: "fallback",
      limitReached: false,
      refreshAvailableAt: expect.any(String),
    });
    expect(response.json()).toMatchObject({
      status: "confirmation_required",
      evidenceCount: 2,
      cached: false,
      insight: null,
    });

    const confirmed = await app.inject({
      method: "POST",
      url: "/api/v1/coach/insight",
      headers: { cookie },
      payload: { confirmEarly: true },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({ status: "unavailable", evidenceCount: 2 });

    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/coach/insight",
      headers: { cookie },
      payload: { confirmEarly: true, unexpected: true },
    });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });
});
