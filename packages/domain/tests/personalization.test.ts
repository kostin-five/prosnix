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

  it("после исследования проверяет лучший сопоставимый вариант", () => {
    const candidates = learningAssignmentCandidates(11).map((candidate) => ({
      ...candidate,
      id: `candidate-${candidate.protocolKey}`,
    }));
    const personalized = candidates.map(
      (candidate) => personalizeAssignment(candidate, profile, 5).assignment,
    );
    const best = personalized[0]!;
    const alternative = personalized[1]!;
    const sequence = (value: ExperimentAssignment) =>
      value.steps.map(({ taskId }) => taskId).join(">");
    const selected = selectPersonalizedAssignment(candidates, profile, 5, [], {
      completedSessions: 11,
      wakeContext: "night_sleep",
      evidence: personalized.flatMap((candidate) =>
        [0, 1].map((index) => ({
          sequenceKey: sequence(candidate),
          wakeContext: "night_sleep" as const,
          durationMinutes: 5 as const,
          baseline: 2,
          postRating: candidate === best ? 7 : candidate === alternative ? 4 : 3,
          followUp: candidate === best ? ("up" as const) : index === 0 ? ("back" as const) : null,
        })),
      ),
    });

    expect(sequence(selected.assignment)).toBe(sequence(best));
    expect(selected.assignment.hypothesis).toContain("лучший наблюдаемый");
  });

  it("не смешивает контексты и не повторяет лучший протокол подряд", () => {
    const candidates = learningAssignmentCandidates(11).map((candidate) => ({
      ...candidate,
      id: `candidate-${candidate.protocolKey}`,
    }));
    const personalized = candidates.map(
      (candidate) => personalizeAssignment(candidate, profile, 5).assignment,
    );
    const sequence = (value: ExperimentAssignment) =>
      value.steps.map(({ taskId }) => taskId).join(">");
    const previous = personalized[0]!;
    const selected = selectPersonalizedAssignment(
      candidates,
      profile,
      5,
      previous.steps.map(({ taskId }) => taskId),
      {
        completedSessions: 11,
        wakeContext: "night_sleep",
        evidence: [
          {
            sequenceKey: sequence(previous),
            wakeContext: "short_nap",
            durationMinutes: 5,
            baseline: 2,
            postRating: 9,
            followUp: "up",
          },
        ],
      },
    );

    expect(sequence(selected.assignment)).not.toBe(sequence(previous));
    expect(selected.assignment.hypothesis).toContain("новый допустимый вариант");
  });

  it("допускает одинаковый стартовый протокол в разных контекстах без отдельных данных", () => {
    const candidates = learningAssignmentCandidates(2).map((candidate) => ({
      ...candidate,
      id: `candidate-${candidate.protocolKey}`,
    }));
    const night = selectPersonalizedAssignment(candidates, profile, 5, [], {
      completedSessions: 0,
      wakeContext: "night_sleep",
      evidence: [],
    });
    const shortNap = selectPersonalizedAssignment(candidates, profile, 5, [], {
      completedSessions: 0,
      wakeContext: "short_nap",
      evidence: [],
    });

    expect(night.assignment.steps.map(({ taskId }) => taskId)).toEqual(
      shortNap.assignment.steps.map(({ taskId }) => taskId),
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

  it("дополняет десятиминутный протокол до семи уникальных разрешённых заданий", () => {
    const fullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };
    for (let completedSessions = 0; completedSessions < 13; completedSessions += 1) {
      const candidate: ExperimentAssignment = {
        ...learningAssignmentCandidates(completedSessions)[0]!,
        id: `long-${completedSessions}`,
      };
      const taskIds = personalizeAssignment(candidate, fullProfile, 10).assignment.steps.map(
        ({ taskId }) => taskId,
      );

      expect(taskIds).toHaveLength(7);
      expect(new Set(taskIds)).toHaveLength(7);
      expect(taskIds.every((taskId) => eligibleWakeTasks(fullProfile).includes(taskId))).toBe(true);
      expect(taskIds).not.toContain("curtains");
      expect(taskIds.filter((taskId) => taskId === "window")).toHaveLength(1);
    }
  });

  it("предлагает одно световое задание для новых протоколов", () => {
    const fullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };

    expect(eligibleWakeTasks(fullProfile)).toContain("window");
    expect(eligibleWakeTasks(fullProfile)).not.toContain("curtains");
  });

  it("ставит мягкое движение перед приседаниями", () => {
    const fullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };
    const movementFirstCandidate: ExperimentAssignment = {
      ...learningAssignmentCandidates(10)[0]!,
      id: "movement-first-long",
    };
    const taskIds = personalizeAssignment(
      movementFirstCandidate,
      fullProfile,
      10,
    ).assignment.steps.map(({ taskId }) => taskId);
    const warmupIndex = Math.min(
      ...[taskIds.indexOf("steps"), taskIds.indexOf("shake")].filter((index) => index >= 0),
    );

    expect(taskIds).toHaveLength(7);
    expect(warmupIndex).toBeLessThan(taskIds.indexOf("squats"));
  });

  it("не нарушает ограничения ради семи шагов", () => {
    const restricted: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "none",
      availableResources: [],
      excludedTaskIds: ["reaction"],
    };
    const taskIds = personalizeAssignment(
      { ...learningAssignmentCandidates(7)[0]!, id: "restricted-long" },
      restricted,
      10,
    ).assignment.steps.map(({ taskId }) => taskId);

    expect(taskIds).toEqual(expect.arrayContaining(["math", "memory", "stroop"]));
    expect(taskIds).toHaveLength(3);
    expect(new Set(taskIds)).toHaveLength(3);
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
