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
  });
});
