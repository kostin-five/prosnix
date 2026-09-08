import { describe, expect, it } from "vitest";

import type { CompletedSessionEvidence } from "../src/model.js";
import { computeAnalyticsProfile } from "../src/analytics/profile.js";

function evidence(
  id: string,
  baseline: number,
  postRating: number,
  overrides: Partial<CompletedSessionEvidence> = {},
): CompletedSessionEvidence {
  return {
    sessionId: id,
    protocolKey: "mixed",
    protocolVersion: 1,
    baseline,
    postRating,
    followUp: null,
    ...overrides,
  };
}

describe("analytics v1", () => {
  it("publishes a preliminary protocol result after one completed session", () => {
    const profile = computeAnalyticsProfile([evidence("s1", 2, 6)]);
    expect(profile.protocolEffects[0]).toMatchObject({
      value: 4,
      evidenceCount: 1,
      confidence: "insufficient",
    });
  });

  it("calculates an effect for each exact task sequence without inferring causation", () => {
    const profile = computeAnalyticsProfile([
      evidence("s1", 2, 5, { sequenceKey: "water>memory" }),
      evidence("s2", 3, 7, { sequenceKey: "water>memory" }),
      evidence("s3", 2, 3, { sequenceKey: "math" }),
    ]);

    expect(profile.sequenceEffects).toEqual([
      expect.objectContaining({
        key: "sequence:math",
        value: 1,
        evidenceCount: 1,
        confidence: "insufficient",
      }),
      expect.objectContaining({
        key: "sequence:water>memory",
        value: 3.5,
        evidenceCount: 2,
        confidence: "insufficient",
      }),
    ]);
  });

  it("does not infer a factor effect from mixed protocols without comparison metadata", () => {
    const profile = computeAnalyticsProfile([
      evidence("s1", 2, 7),
      evidence("s2", 3, 8),
      evidence("s3", 2, 6),
    ]);

    expect(profile.averageDelta.value).toBeCloseTo(14 / 3);
    expect(profile.protocolEffects[0]).toMatchObject({
      key: "protocol:mixed@1",
      evidenceCount: 3,
      confidence: "low",
    });
    expect(profile.factorEffects).toEqual([]);
  });

  it("excludes unanswered follow-ups from rise-success denominator", () => {
    const profile = computeAnalyticsProfile([
      evidence("s1", 2, 6, { followUp: "up" }),
      evidence("s2", 2, 5, { followUp: "back" }),
      evidence("s3", 2, 7),
    ]);

    expect(profile.riseSuccess).toMatchObject({ value: 0.5, evidenceCount: 2 });
    expect(profile.riseSuccess.evidenceIds).toEqual(["s1", "s2"]);
  });

  it("publishes a low-confidence factor effect after three comparable pairs", () => {
    const withMovement = [5, 6, 4].map((delta, index) =>
      evidence(`with-${index}`, 2, 2 + delta, {
        protocolKey: "with-movement",
        comparison: {
          groupKey: "movement-a",
          factorKey: "movement",
          level: "with",
        },
      }),
    );
    const withoutMovement = [2, 1, 3].map((delta, index) =>
      evidence(`without-${index}`, 2, 2 + delta, {
        protocolKey: "without-movement",
        comparison: {
          groupKey: "movement-a",
          factorKey: "movement",
          level: "without",
        },
      }),
    );

    const profile = computeAnalyticsProfile([...withMovement, ...withoutMovement]);

    expect(profile.factorEffects).toHaveLength(1);
    expect(profile.factorEffects[0]).toMatchObject({
      key: "factor:movement:movement-a",
      value: 3,
      evidenceCount: 3,
      confidence: "low",
    });
    expect(profile.comparisonProgress![0]).toEqual({
      key: "factor:movement:movement-a",
      factorKey: "movement",
      groupKey: "movement-a",
      withCount: 3,
      withoutCount: 3,
      pairCount: 3,
      targetPairs: 3,
      status: "ready",
    });
  });

  it("показывает точный прогресс до готовности факторного сравнения", () => {
    const profile = computeAnalyticsProfile([
      evidence("with-1", 2, 6, {
        comparison: { groupKey: "movement-a", factorKey: "movement", level: "with" },
      }),
      evidence("with-2", 3, 7, {
        comparison: { groupKey: "movement-a", factorKey: "movement", level: "with" },
      }),
      evidence("without-1", 2, 4, {
        comparison: { groupKey: "movement-a", factorKey: "movement", level: "without" },
      }),
    ]);

    expect(profile.methodVersion).toBe("analytics-v2");
    expect(profile.factorEffects).toEqual([]);
    expect(profile.comparisonProgress![0]).toMatchObject({
      withCount: 2,
      withoutCount: 1,
      pairCount: 1,
      targetPairs: 3,
      status: "collecting",
    });
  });

  it("groups paired deltas by the user's local calendar date", () => {
    const profile = computeAnalyticsProfile(
      [
        evidence("s1", 2, 6, { completedAt: "2026-09-05T20:30:00.000Z" }),
        evidence("s2", 4, 6, { completedAt: "2026-09-05T22:30:00.000Z" }),
        evidence("s3", 3, 4, { completedAt: "2026-09-06T07:00:00.000Z" }),
      ],
      "2026-09-06T08:00:00.000Z",
      "Europe/Moscow",
    );

    expect(profile.dailyTrend).toEqual([
      { localDate: "2026-09-05", averageDelta: 4, evidenceCount: 1, sessionIds: ["s1"] },
      {
        localDate: "2026-09-06",
        averageDelta: 1.5,
        evidenceCount: 2,
        sessionIds: ["s2", "s3"],
      },
    ]);
  });
});
