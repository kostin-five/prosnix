import { describe, expect, it } from "vitest";

import {
  learningAssignmentCandidates,
  selectLearningAssignment,
} from "../src/experiments/learning.js";

describe("план первоначальных экспериментов", () => {
  it("оставляет сопоставимую пару с движением для адаптивной проверки", () => {
    const candidates = learningAssignmentCandidates(7);
    const withMovement = candidates.find(({ protocolKey }) =>
      protocolKey.includes("light-movement"),
    );
    const withoutMovement = candidates.find(
      ({ protocolKey }) => protocolKey === "adaptive-light-first",
    );

    expect(withMovement?.comparison).toEqual({
      groupKey: "movement-b",
      factorKey: "movement",
      level: "with",
    });
    expect(withoutMovement?.comparison).toEqual({
      groupKey: "movement-b",
      factorKey: "movement",
      level: "without",
    });
    expect(
      withMovement?.steps
        .filter(({ category }) => category !== "movement")
        .map(({ taskId }) => taskId),
    ).toEqual(withoutMovement?.steps.map(({ taskId }) => taskId));
  });

  it("первые семь назначений исследуют разные порядки", () => {
    const signatures = Array.from({ length: 7 }, (_, index) =>
      selectLearningAssignment(index)
        .steps.map(({ taskId }) => taskId)
        .join(">"),
    );

    expect(new Set(signatures).size).toBe(7);
  });

  it("чередует безопасные последовательности после периода изучения", () => {
    const continuation = [7, 8, 9, 10].map((count) => selectLearningAssignment(count));

    expect(continuation[0]).toMatchObject({
      phase: "adaptive",
      protocolVersion: 7,
      strategyVersion: "adaptive-v7",
    });
    expect(continuation[1]).toMatchObject({ strategyVersion: "adaptive-v7" });
    expect(continuation[2]).toMatchObject({ strategyVersion: "adaptive-v7" });
    expect(continuation[3]?.protocolKey).not.toBe(continuation[0]?.protocolKey);
    expect(
      continuation.slice(1).every((assignment, index) => {
        const previous = continuation[index]!;
        return (
          assignment.steps.map(({ taskId }) => taskId).join(",") !==
          previous.steps.map(({ taskId }) => taskId).join(",")
        );
      }),
    ).toBe(true);
  });

  it("предлагает альтернативы для проверки после персонализации", () => {
    const candidates = learningAssignmentCandidates(8);
    expect(candidates).toHaveLength(7);
    expect(new Set(candidates.map(({ protocolKey }) => protocolKey)).size).toBe(7);
    expect(
      candidates.every(
        ({ strategyVersion, phase }) => strategyVersion === "adaptive-v7" && phase === "adaptive",
      ),
    ).toBe(true);
    expect(candidates.flatMap(({ steps }) => steps.map(({ taskId }) => taskId))).not.toContain(
      "curtains",
    );
  });
});
