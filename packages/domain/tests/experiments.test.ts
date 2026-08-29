import { describe, expect, it } from "vitest";

import { selectLearningAssignment } from "../src/experiments/learning.js";

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

  it("возвращает безопасный fallback после периода изучения", () => {
    expect(selectLearningAssignment(7)).toMatchObject({
      phase: "fallback",
      strategyVersion: "fallback-v1",
    });
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
