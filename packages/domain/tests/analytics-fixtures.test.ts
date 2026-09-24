import { describe, expect, it } from "vitest";

import { computeAnalyticsProfile, type CompletedSessionEvidence } from "../src/index.js";

const comparableScope = { wakeContext: "night_sleep" as const, durationMinutes: 5 as const };

const fixture: CompletedSessionEvidence[] = [
  {
    sessionId: "with-1",
    protocolKey: "movement-plus",
    protocolVersion: 1,
    baseline: 2,
    postRating: 7,
    followUp: "up",
    sequenceKey: "water>memory",
    ...comparableScope,
    comparison: { groupKey: "movement-a", factorKey: "movement", level: "with" },
  },
  {
    sessionId: "without-1",
    protocolKey: "cognitive-core",
    protocolVersion: 1,
    baseline: 2,
    postRating: 4,
    followUp: "back",
    sequenceKey: "math",
    ...comparableScope,
    comparison: { groupKey: "movement-a", factorKey: "movement", level: "without" },
  },
  {
    sessionId: "with-2",
    protocolKey: "movement-plus",
    protocolVersion: 1,
    baseline: 3,
    postRating: 9,
    followUp: "up",
    sequenceKey: "water>memory",
    ...comparableScope,
    comparison: { groupKey: "movement-a", factorKey: "movement", level: "with" },
  },
  {
    sessionId: "without-2",
    protocolKey: "cognitive-core",
    protocolVersion: 1,
    baseline: 3,
    postRating: 4,
    followUp: null,
    sequenceKey: "math",
    ...comparableScope,
    comparison: { groupKey: "movement-a", factorKey: "movement", level: "without" },
  },
  {
    sessionId: "with-3",
    protocolKey: "movement-plus",
    protocolVersion: 1,
    baseline: 2,
    postRating: 6,
    followUp: "drowsy",
    sequenceKey: "water>memory",
    ...comparableScope,
    comparison: { groupKey: "movement-a", factorKey: "movement", level: "with" },
  },
  {
    sessionId: "without-3",
    protocolKey: "cognitive-core",
    protocolVersion: 1,
    baseline: 2,
    postRating: 5,
    followUp: "up",
    sequenceKey: "math",
    ...comparableScope,
    comparison: { groupKey: "movement-a", factorKey: "movement", level: "without" },
  },
];

describe("регрессионный набор аналитики v2", () => {
  it("воспроизводит показатели и использованные источники", () => {
    const first = computeAnalyticsProfile(fixture);
    const second = computeAnalyticsProfile(structuredClone(fixture));

    expect(second).toEqual(first);
    expect(first.methodVersion).toBe("analytics-v2");
    expect(first.averageDelta).toMatchObject({
      value: 3.5,
      evidenceCount: 6,
      confidence: "medium",
    });
    expect(first.riseSuccess).toMatchObject({ value: 0.6, evidenceCount: 5, confidence: "low" });
    expect(first.factorEffects[0]).toMatchObject({
      key: "factor:movement:movement-a",
      value: 3,
      evidenceCount: 3,
      confidence: "low",
    });
    expect(first.factorEffects[0]?.evidenceIds).toEqual([
      "with-1",
      "with-2",
      "with-3",
      "without-1",
      "without-2",
      "without-3",
    ]);
    expect(first.sequenceEffects).toEqual([
      expect.objectContaining({
        key: "sequence:math|context:night_sleep|budget:5m",
        value: 2,
        evidenceCount: 3,
        confidence: "low",
      }),
      expect.objectContaining({
        key: "sequence:water>memory|context:night_sleep|budget:5m",
        value: 5,
        evidenceCount: 3,
        confidence: "low",
      }),
    ]);
  });
});
