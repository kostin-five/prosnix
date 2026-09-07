import { describe, expect, it } from "vitest";

import {
  eligibleWakeTasks,
  learningAssignmentCandidates,
  personalizeAssignment,
  SAFE_WAKE_PROFILE,
  selectPersonalizedAssignment,
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
  it("не повторяет фактическую последовательность после фильтрации профилем", () => {
    const candidates = learningAssignmentCandidates(8).map((candidate) => ({
      ...candidate,
      id: `candidate-${candidate.protocolKey}`,
    }));
    const first = personalizeAssignment(candidates[0]!, SAFE_WAKE_PROFILE, 5);
    const selected = selectPersonalizedAssignment(
      candidates,
      SAFE_WAKE_PROFILE,
      5,
      first.assignment.steps.map(({ taskId }) => taskId),
    );

    expect(selected.assignment.steps.map(({ taskId }) => taskId)).not.toEqual(
      first.assignment.steps.map(({ taskId }) => taskId),
    );
  });

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

  it("добавляет доступное активное действие к пяти минутам", () => {
    const result = personalizeAssignment(
      { ...assignment, steps: [{ index: 0, taskId: "math", category: "cognitive" }] },
      profile,
      5,
    );
    expect(result.assignment.steps.map(({ taskId }) => taskId)).toContain("steps");
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
