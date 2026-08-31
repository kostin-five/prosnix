import { describe, expect, it, vi } from "vitest";

import type {
  AnalyticsProfile,
  AnalyticsRepository,
  CoachInsightRecord,
  CoachInsightRepository,
} from "@awc/domain";
import type { CoachGateway } from "../../src/coach/deepseek.js";
import { CoachService } from "../../src/coach/service.js";

function profile(evidenceCount: number): AnalyticsProfile {
  return {
    methodVersion: "analytics-v1",
    computedAt: "2026-08-31T09:00:00.000Z",
    averageDelta: {
      key: "average-delta",
      value: evidenceCount ? 3 : null,
      evidenceCount,
      evidenceIds: Array.from({ length: evidenceCount }, (_, index) => `session-${index}`),
      confidence: evidenceCount < 3 ? "insufficient" : "low",
    },
    riseSuccess: {
      key: "rise-success",
      value: 0.75,
      evidenceCount,
      evidenceIds: [],
      confidence: evidenceCount < 3 ? "insufficient" : "low",
    },
    protocolEffects: [],
    factorEffects: [],
  };
}

function setup(evidenceCount: number) {
  let saved: CoachInsightRecord | null = null;
  const analytics: AnalyticsRepository = { recompute: vi.fn(async () => profile(evidenceCount)) };
  const cache: CoachInsightRepository = {
    findByUserId: vi.fn(async () => saved),
    save: vi.fn(async (record) => {
      saved = record;
      return record;
    }),
  };
  const generate: CoachGateway["generate"] = async () => ({
    summary: "Прирост стабилен.",
    nextExperiment: "Повтори протокол.",
    caveat: "Пока мало данных.",
    model: "deepseek-v4-flash",
  });
  const gateway = { generate: vi.fn(generate) };
  return { service: new CoachService(analytics, cache, gateway), cache, gateway };
}

describe("CoachService", () => {
  it("does not call AI with insufficient evidence", async () => {
    const { service, gateway } = setup(2);
    await expect(service.getInsight("user-1")).resolves.toMatchObject({
      status: "insufficient",
      evidenceCount: 2,
    });
    expect(gateway.generate).not.toHaveBeenCalled();
  });

  it("caches an insight by aggregate fingerprint", async () => {
    const { service, gateway } = setup(4);
    await expect(service.getInsight("user-1")).resolves.toMatchObject({
      status: "ready",
      cached: false,
    });
    await expect(service.getInsight("user-1")).resolves.toMatchObject({
      status: "ready",
      cached: true,
    });
    expect(gateway.generate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(gateway.generate.mock.calls[0]?.[0])).not.toContain("session-0");
  });

  it("degrades safely when the provider fails", async () => {
    const { service, gateway } = setup(4);
    gateway.generate.mockRejectedValueOnce(new Error("timeout"));
    await expect(service.getInsight("user-1")).resolves.toMatchObject({
      status: "unavailable",
      insight: null,
    });
  });
});
