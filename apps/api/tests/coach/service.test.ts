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
    sequenceEffects: [],
    dailyTrend: Array.from({ length: Math.min(evidenceCount, 3) }, (_, index) => ({
      localDate: `2026-09-0${index + 1}`,
      averageDelta: index + 1,
      evidenceCount: 1,
      sessionIds: [`session-${index}`],
    })),
  };
}

function setup(evidenceCount: number) {
  let saved: CoachInsightRecord | null = null;
  const analytics: AnalyticsRepository = { recompute: vi.fn(async () => profile(evidenceCount)) };
  const cache: CoachInsightRepository = {
    findByUserId: vi.fn(async () => saved),
    findTimezoneByUserId: vi.fn(async () => "Europe/Moscow"),
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
  it("asks for confirmation and does not call AI with insufficient evidence", async () => {
    const { service, gateway } = setup(2);
    await expect(service.getInsight("user-1")).resolves.toMatchObject({
      status: "confirmation_required",
      evidenceCount: 2,
      insight: null,
    });
    expect(gateway.generate).not.toHaveBeenCalled();
  });

  it("creates one preliminary report after explicit early confirmation", async () => {
    const { service, gateway } = setup(2);
    await expect(
      service.getInsight("user-1", new Date("2026-09-05T08:00:00.000Z"), {
        confirmEarly: true,
      }),
    ).resolves.toMatchObject({ status: "ready", evidenceCount: 2, source: "provider" });
    expect(gateway.generate).toHaveBeenCalledOnce();
  });

  it("returns a cached preliminary report without asking for confirmation again", async () => {
    const { service, gateway } = setup(2);
    const now = new Date("2026-09-05T08:00:00.000Z");

    await expect(service.getInsight("user-1", now, { confirmEarly: true })).resolves.toMatchObject({
      status: "ready",
      cached: false,
      source: "provider",
    });
    await expect(service.getInsight("user-1", now)).resolves.toMatchObject({
      status: "ready",
      cached: true,
      source: "cache",
    });
    expect(gateway.generate).toHaveBeenCalledOnce();
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
      insight: {
        summary: expect.stringContaining("Через 15 минут"),
        nextExperiment: expect.any(String),
        caveat: expect.stringContaining("Базовый отчёт"),
      },
    });
    await service.getInsight("user-1", new Date("2026-09-05T10:00:00.000Z"));
    expect(gateway.generate).toHaveBeenCalledTimes(1);
  });

  it("removes evidence ids and derives stable trend signals", async () => {
    const { service, gateway } = setup(4);
    await service.getInsight("user-1");
    const payload = gateway.generate.mock.calls[0]?.[0];
    expect(payload?.trendSignals).toEqual({
      observedDays: 3,
      recentDirection: "improving",
      variability: 0.7,
    });
    expect(JSON.stringify(payload)).not.toContain("session-0");
  });

  it("does not call the provider twice in one local day when evidence changes", async () => {
    const { service, gateway } = setup(4);
    await expect(
      service.getInsight("user-1", new Date("2026-09-05T06:00:00.000Z")),
    ).resolves.toMatchObject({ source: "provider", limitReached: true });

    await expect(
      service.getInsight("user-1", new Date("2026-09-05T18:00:00.000Z")),
    ).resolves.toMatchObject({ source: "cache", cached: true, limitReached: true });
    expect(gateway.generate).toHaveBeenCalledTimes(1);
  });

  it("coalesces simultaneous requests from the same user", async () => {
    const { service, gateway } = setup(4);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    gateway.generate.mockImplementationOnce(async (payload) => {
      await pending;
      return {
        summary: `Проверено ${payload.averageDelta.evidenceCount} сессии.`,
        nextExperiment: "Повтори протокол.",
        caveat: "Пока мало данных.",
        model: "deepseek-v4-flash",
      };
    });

    const first = service.getInsight("user-1", new Date("2026-09-05T06:00:00.000Z"));
    const second = service.getInsight("user-1", new Date("2026-09-05T06:00:01.000Z"));
    release();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual(secondResult);
    expect(gateway.generate).toHaveBeenCalledTimes(1);
  });

  it("reports the next local midnight for the saved timezone", async () => {
    const { service } = setup(4);
    await expect(
      service.getInsight("user-1", new Date("2026-09-05T18:00:00.000Z")),
    ).resolves.toMatchObject({ refreshAvailableAt: "2026-09-05T21:00:00.000Z" });
  });
});
