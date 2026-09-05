import { describe, expect, it } from "vitest";

import type { AdminGrowthSummary } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

const summary: AdminGrowthSummary = {
  users: { total: 10, new: 3, active: 5 },
  sessions: { started: 8, completed: 6, abandoned: 1 },
  funnel: { assigned: 10, started: 8, completed: 6, followedUp: 4 },
  wakeQuality: { pairedSessions: 6, averageDelta: 2.5, improvedSessions: 5 },
  followUp: { eligible: 6, answered: 4, up: 3, back: 1, drowsy: 0 },
  retention: { d1Eligible: 8, d1Retained: 3, d7Eligible: 4, d7Retained: 1 },
  timeline: [{ date: "2026-08-26", newUsers: 1, startedSessions: 2, completedSessions: 1 }],
  breakdowns: {
    contexts: [{ key: "night_sleep", sessions: 5, completed: 4 }],
    durations: [{ minutes: 5, sessions: 5, completed: 4 }],
  },
  features: {
    capabilityProfiles: 3,
    routinesEnabled: 2,
    routineRuns: 3,
    routineRunsCompleted: 1,
    aiInsightsGenerated: 2,
  },
  deliveries: { dailySent: 6, followUpSent: 5, failed: 0, blocked: 0 },
  billing: { activeSubscriptions: 0, grossStars: 0 },
};

describe("admin growth contract", () => {
  it("is fail-closed and returns aggregates without identifiers", async () => {
    const dependencies = createMemoryDependencies();
    let allowed = false;
    const app = await createApp(testConfig, {
      ...dependencies,
      adminGrowthRepository: {
        isAllowed: async () => allowed,
        summarize: async () => summary,
      },
      now: () => testNow,
    });
    const cookie = await authenticateTestUser(app);
    expect(
      (await app.inject({ url: "/api/v1/admin/growth", headers: { cookie } })).statusCode,
    ).toBe(404);
    allowed = true;
    const response = await app.inject({ url: "/api/v1/admin/growth?days=7", headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      users: summary.users,
      sessions: { completed: 6, completionRate: 0.75 },
      funnel: { assigned: 10, startRate: 0.8, completionRate: 0.75, followUpRate: 0.6667 },
      wakeQuality: { pairedSessions: 6, averageDelta: 2.5, improvedRate: 0.8333 },
      followUp: { eligible: 6, answered: 4, responseRate: 0.6667, stayedUpRate: 0.75 },
      retention: { d1: { eligible: 8, retained: 3, rate: 0.375 } },
      breakdowns: {
        contexts: [{ key: "night_sleep", sessions: 5, completed: 4, completionRate: 0.8 }],
      },
      features: { routinesEnabled: 2, aiInsightsGenerated: 2 },
      deliveries: { terminal: 11, successRate: 1 },
    });
    expect(response.body).not.toMatch(/telegramUserId|userId|sessionId|evidenceIds|rating/);
    expect(
      (await app.inject({ url: "/api/v1/admin/growth?days=8", headers: { cookie } })).statusCode,
    ).toBe(400);
    await app.close();
  });
});
