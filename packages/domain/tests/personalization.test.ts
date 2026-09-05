import { describe, expect, it } from "vitest";

import {
  eligibleWakeTasks,
  personalizeAssignment,
  type ExperimentAssignment,
  type WakeCapabilityProfile,
} from "../src/index.js";

const assignment: ExperimentAssignment = {
  id: "planned",
  protocolKey: "movement-a-with",
  protocolVersion: 1,
  strategyVersion: "learning-v1",
  phase: "learning",
  hypothesis: "Проверяем движение",
  steps: [
    { index: 0, taskId: "steps", category: "movement" },
    { index: 1, taskId: "squats", category: "movement" },
    { index: 2, taskId: "water", category: "behavioral" },
    { index: 3, taskId: "stroop", category: "cognitive" },
  ],
  comparison: { groupKey: "movement-a", factorKey: "movement", level: "with" },
};

const profile: WakeCapabilityProfile = {
  movementLevel: "light",
  availableResources: ["water"],
  excludedTaskIds: [],
  defaultDurationMinutes: 5,
  onboardingCompleted: true,
  revision: 3,
};

describe("персонализация протокола", () => {
  it("обнаруживает профиль без единого допустимого задания", () => {
    expect(
      eligibleWakeTasks({
        ...profile,
        movementLevel: "none",
        availableResources: [],
        excludedTaskIds: ["math", "memory", "stroop", "reaction"],
      }),
    ).toEqual([]);
  });
  it("исключает интенсивное движение и недоступные условия", () => {
    const result = personalizeAssignment(assignment, profile, 5);
    expect(result.assignment.steps.map(({ taskId }) => taskId)).toEqual([
      "steps",
      "water",
      "stroop",
    ]);
    expect(result.assignment.comparison).toBeUndefined();
    expect(result.snapshot).toMatchObject({
      profileRevision: 3,
      fallbackReason: "limited_eligible_tasks",
    });
  });

  it("укладывает оценочную длительность в бюджет с допуском 30 секунд", () => {
    const result = personalizeAssignment(
      assignment,
      { ...profile, movementLevel: "full", availableResources: ["water", "floor_space"] },
      2,
    );
    expect(result.assignment.steps.map(({ taskId }) => taskId)).toEqual([
      "steps",
      "squats",
      "water",
      "stroop",
    ]);
  });

  it("выбирает консервативный fallback без нарушения явных запретов", () => {
    const result = personalizeAssignment(
      { ...assignment, steps: [{ index: 0, taskId: "squats", category: "movement" }] },
      { ...profile, movementLevel: "none", availableResources: [], excludedTaskIds: ["reaction"] },
      2,
    );
    expect(result.assignment.steps.map(({ taskId }) => taskId)).toEqual(["stroop", "memory"]);
    expect(result.assignment.phase).toBe("fallback");
  });
});
