import { describe, expect, it } from "vitest";

import {
  learningAssignmentCandidates,
  selectLearningAssignment,
} from "../src/experiments/learning.js";

describe("план первоначальных экспериментов", () => {
  it("фиксирует сопоставимую пару с движением до начала сессии", () => {
    const withMovement = selectLearningAssignment(1);
    const withoutMovement = selectLearningAssignment(2);

    expect(withMovement.comparison).toEqual({
      groupKey: "movement-a",
      factorKey: "movement",
      level: "with",
    });
    expect(withoutMovement.comparison).toEqual({
      groupKey: "movement-a",
      factorKey: "movement",
      level: "without",
    });
    expect(withMovement.steps.filter(({ category }) => category !== "movement")).toEqual(
      withoutMovement.steps,
    );
  });

  it("чередует безопасные последовательности после периода изучения", () => {
    const continuation = [7, 8, 9, 10].map((count) => selectLearningAssignment(count));

    expect(continuation[0]).toMatchObject({ phase: "fallback" });
    expect(continuation[1]).toMatchObject({ strategyVersion: "continuation-v1" });
    expect(continuation[2]).toMatchObject({ strategyVersion: "continuation-v1" });
    expect(continuation[3]?.protocolKey).toBe(continuation[0]?.protocolKey);
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
    expect(learningAssignmentCandidates(8).map(({ protocolKey }) => protocolKey)).toEqual([
      "cognitive-refresh",
      "activation-mix",
      "safe-fallback",
    ]);
  });

  it("за семь сессий накапливает три независимых сравнения одного фактора", () => {
    const comparisons = Array.from(
      { length: 7 },
      (_, index) => selectLearningAssignment(index).comparison,
    ).filter((comparison) => comparison !== undefined);

    expect(comparisons.filter(({ level }) => level === "with")).toHaveLength(3);
    expect(comparisons.filter(({ level }) => level === "without")).toHaveLength(3);
    expect(new Set(comparisons.map(({ groupKey }) => groupKey))).toEqual(new Set(["movement-a"]));
  });
});
