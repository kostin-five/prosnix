import { describe, expect, it } from "vitest";

import {
  eligibleWakeTasks,
  learningAssignmentCandidates,
  plannedProtocolSeconds,
  personalizeAssignment,
  SAFE_WAKE_PROFILE,
  selectPersonalizedAssignment,
  selectTaskSubstitution,
  selectRecoverySteps,
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
  it("детерминированно заменяет только текущий или следующий шаг без повторов", () => {
    const fullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };
    const steps = [
      { index: 0, taskId: "math", category: "cognitive" },
      { index: 1, taskId: "memory", category: "cognitive" },
      { index: 2, taskId: "sit_edge", category: "movement" },
      { index: 3, taskId: "steps", category: "movement" },
    ] as const;

    expect(
      selectTaskSubstitution({
        steps,
        targetIndex: 1,
        currentStepIndex: 0,
        completedTaskIds: [],
        rejectedTaskIds: ["stroop"],
        profile: fullProfile,
        durationMinutes: 5,
        comparisonFactorKey: "movement",
        reason: "unwilling_now",
      }),
    ).toMatchObject({ replacementTaskId: "reaction", preservesComparison: true });
    expect(
      selectTaskSubstitution({
        steps,
        targetIndex: 2,
        currentStepIndex: 0,
        completedTaskIds: [],
        rejectedTaskIds: [],
        profile: fullProfile,
        durationMinutes: 5,
        reason: "cannot_do",
      }),
    ).toBeNull();
  });

  it("исследует семь разных последовательностей до повторной проверки", () => {
    const fullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };
    const movementOnlyProfile: WakeCapabilityProfile = {
      ...fullProfile,
      availableResources: ["floor_space"],
    };

    for (const activeProfile of [fullProfile, movementOnlyProfile]) {
      const signatures = Array.from({ length: 7 }, (_, completedSessions) => {
        const candidates = learningAssignmentCandidates(completedSessions).map(
          (candidate, index) => ({
            ...candidate,
            id: `calibration-${completedSessions}-${index}`,
          }),
        );
        return selectPersonalizedAssignment(candidates, activeProfile, 5)
          .assignment.steps.map(({ taskId }) => taskId)
          .join(">");
      });

      expect(new Set(signatures).size).toBe(7);
    }
  });

  it("балансирует состав первых семи протоколов полного профиля", () => {
    const fullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };
    const sequences = Array.from({ length: 7 }, (_, completedSessions) => {
      const candidates = learningAssignmentCandidates(completedSessions).map(
        (candidate, index) => ({
          ...candidate,
          id: `balanced-${completedSessions}-${index}`,
        }),
      );
      const selected = selectPersonalizedAssignment(candidates, fullProfile, 5).assignment;
      expect(selected.protocolVersion).toBe(8);
      expect(selected.strategyVersion).toBe("learning-v6");
      return selected.steps.map(({ taskId }) => taskId);
    });
    const count = (taskId: (typeof sequences)[number][number]) =>
      sequences.filter((taskIds) => taskIds.includes(taskId)).length;

    expect(new Set(sequences.map((taskIds) => taskIds.join(">"))).size).toBe(7);
    expect(new Set(sequences.map((taskIds) => taskIds[0])).size).toBeGreaterThanOrEqual(4);
    expect(new Set(sequences.map((taskIds) => taskIds.indexOf("sit_edge"))).size).toBeGreaterThan(
      1,
    );
    expect(count("squats")).toBeGreaterThanOrEqual(2);
    expect(count("squats")).toBeLessThanOrEqual(4);

    for (const taskIds of sequences.filter((items) => items.includes("squats"))) {
      const warmupIndex = Math.min(
        ...[taskIds.indexOf("steps"), taskIds.indexOf("shake")].filter((index) => index >= 0),
      );
      expect(warmupIndex).toBeLessThan(taskIds.indexOf("squats"));
    }
  });

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
    const taskIds = result.assignment.steps.map(({ taskId }) => taskId);
    expect(taskIds).not.toContain("squats");
    expect(taskIds).not.toContain("window");
    expect(taskIds.indexOf("sit_edge")).toBeLessThan(taskIds.indexOf("steps"));
    expect(plannedProtocolSeconds(result.assignment.steps, 5)).toBeGreaterThanOrEqual(270);
    expect(plannedProtocolSeconds(result.assignment.steps, 5)).toBeLessThanOrEqual(330);
    expect(result.assignment.comparison).toBeUndefined();
    expect(result.snapshot).toMatchObject({
      profileRevision: 3,
      fallbackReason: "limited_eligible_tasks",
    });
  });

  it("укладывает двухминутный протокол в диапазон 90–110%", () => {
    const result = personalizeAssignment(
      assignment,
      { ...profile, movementLevel: "full", availableResources: ["water", "floor_space"] },
      2,
    );
    const taskIds = result.assignment.steps.map(({ taskId }) => taskId);
    expect(taskIds).toEqual(["sit_edge", "steps", "squats", "water"]);
    expect(plannedProtocolSeconds(result.assignment.steps, 2)).toBeGreaterThanOrEqual(108);
    expect(plannedProtocolSeconds(result.assignment.steps, 2)).toBeLessThanOrEqual(132);
  });

  it("добавляет доступное активное действие к пяти минутам", () => {
    const result = personalizeAssignment(
      { ...assignment, steps: [{ index: 0, taskId: "math", category: "cognitive" }] },
      profile,
      5,
    );
    const taskIds = result.assignment.steps.map(({ taskId }) => taskId);
    expect(taskIds.some((taskId) => ["steps", "shake", "water", "window"].includes(taskId))).toBe(
      true,
    );
    expect(plannedProtocolSeconds(result.assignment.steps, 5)).toBeGreaterThanOrEqual(270);
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

      expect(new Set(taskIds)).toHaveLength(taskIds.length);
      expect(
        taskIds.every(
          (taskId) => taskId === "sit_edge" || eligibleWakeTasks(fullProfile).includes(taskId),
        ),
      ).toBe(true);
      expect(taskIds).not.toContain("curtains");
      expect(taskIds.filter((taskId) => taskId === "window")).toHaveLength(1);
      expect(
        plannedProtocolSeconds(
          personalizeAssignment(candidate, fullProfile, 10).assignment.steps,
          10,
        ),
      ).toBeGreaterThanOrEqual(540);
      expect(
        plannedProtocolSeconds(
          personalizeAssignment(candidate, fullProfile, 10).assignment.steps,
          10,
        ),
      ).toBeLessThanOrEqual(660);
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

  it("добавляет задания v9 только после новых явных разрешений", () => {
    const legacyFullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };
    const v9Profile: WakeCapabilityProfile = {
      ...legacyFullProfile,
      availableResources: [
        "water",
        "bright_light",
        "floor_space",
        "wash_access",
        "active_movement",
      ],
    };

    expect(eligibleWakeTasks(legacyFullProfile, { v9Enabled: true })).not.toEqual(
      expect.arrayContaining(["cool_wash", "pushups"]),
    );
    expect(eligibleWakeTasks(v9Profile)).not.toEqual(
      expect.arrayContaining(["cool_wash", "pushups"]),
    );
    expect(eligibleWakeTasks(v9Profile, { v9Enabled: true })).toEqual(
      expect.arrayContaining(["cool_wash", "pushups"]),
    );
  });

  it("ставит отжимания после подъёма и разминки в протоколе v9", () => {
    const v9Profile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["floor_space", "wash_access", "active_movement"],
    };
    const result = personalizeAssignment(
      {
        ...assignment,
        protocolKey: "catalog-v9-order",
        steps: [
          { index: 0, taskId: "cool_wash", category: "behavioral" },
          { index: 1, taskId: "pushups", category: "movement" },
        ],
      },
      v9Profile,
      2,
      { v9Enabled: true },
    );
    const taskIds = result.assignment.steps.map(({ taskId }) => taskId);

    expect(result.assignment.protocolVersion).toBe(9);
    expect(taskIds).toEqual(expect.arrayContaining(["cool_wash", "pushups"]));
    expect(taskIds.indexOf("sit_edge")).toBeLessThan(taskIds.indexOf("shake"));
    expect(taskIds.indexOf("shake")).toBeLessThan(taskIds.indexOf("pushups"));
  });

  it("соблюдает отдельный запрет отжиманий в каталоге v9", () => {
    const v9Profile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["floor_space", "wash_access", "active_movement"],
      excludedTaskIds: ["pushups"],
    };

    expect(eligibleWakeTasks(v9Profile, { v9Enabled: true })).toContain("cool_wash");
    expect(eligibleWakeTasks(v9Profile, { v9Enabled: true })).not.toContain("pushups");
  });

  it("чередует новые задания между протоколами каталога v9", () => {
    const v9Profile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: [
        "water",
        "bright_light",
        "floor_space",
        "wash_access",
        "active_movement",
      ],
    };
    const sequences = Array.from({ length: 13 }, (_, completedSessions) => {
      const candidates = learningAssignmentCandidates(completedSessions).map(
        (candidate, index) => ({ ...candidate, id: `v9-${completedSessions}-${index}` }),
      );
      return selectPersonalizedAssignment(candidates, v9Profile, 5, [], undefined, {
        v9Enabled: true,
      }).assignment.steps.map(({ taskId }) => taskId);
    });

    expect(new Set(sequences.map((taskIds) => taskIds.join(">"))).size).toBeGreaterThanOrEqual(7);
    expect(sequences.some((taskIds) => taskIds.includes("cool_wash"))).toBe(true);
    expect(sequences.some((taskIds) => taskIds.includes("pushups"))).toBe(true);
  });

  it("ставит мягкое движение перед приседаниями", () => {
    const fullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };
    const candidateWithSquats = learningAssignmentCandidates(7).find(({ steps }) =>
      steps.some(({ taskId }) => taskId === "squats"),
    );
    if (!candidateWithSquats) throw new Error("Candidate with squats not found");
    const movementFirstCandidate: ExperimentAssignment = {
      ...candidateWithSquats,
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

    expect(warmupIndex).toBeLessThan(taskIds.indexOf("squats"));
    expect(taskIds.indexOf("sit_edge")).toBeLessThan(warmupIndex);
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
    expect(result.assignment.steps.map(({ taskId }) => taskId)).toEqual(["stroop", "math"]);
    expect(result.assignment.phase).toBe("fallback");
  });

  it("оставляет когнитивное задание первым и вставляет переход только перед подъёмом", () => {
    const fullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };
    const candidate: ExperimentAssignment = {
      ...learningAssignmentCandidates(0)[0]!,
      id: "cognitive-first",
    };
    const taskIds = personalizeAssignment(candidate, fullProfile, 5).assignment.steps.map(
      ({ taskId }) => taskId,
    );
    const firstStanding = taskIds.findIndex((taskId) =>
      ["water", "window", "steps", "squats", "shake"].includes(taskId),
    );

    expect(taskIds[0]).toBe("math");
    expect(firstStanding).toBeGreaterThan(0);
    expect(taskIds[firstStanding - 1]).toBe("sit_edge");
    expect(taskIds.filter((taskId) => taskId === "sit_edge")).toHaveLength(1);
  });

  it("формирует recovery не длиннее 90 секунд и не повторяет конец primary", () => {
    const fullProfile: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "full",
      availableResources: ["water", "bright_light", "floor_space"],
    };
    const steps = selectRecoverySteps({
      primarySteps: [
        { index: 0, taskId: "math", category: "cognitive" },
        { index: 1, taskId: "memory", category: "cognitive" },
        { index: 2, taskId: "reaction", category: "cognitive" },
      ],
      completedTaskIds: ["math", "memory", "reaction"],
      rejectedTaskIds: ["water"],
      profile: fullProfile,
    });

    expect(steps.map(({ taskId }) => taskId)).toEqual(["sit_edge", "window"]);
    expect(plannedProtocolSeconds(steps, 2)).toBeLessThanOrEqual(90);
    expect(steps).toHaveLength(2);
  });

  it("не создаёт recovery, когда все разрешённые альтернативы отклонены или были в конце", () => {
    const restricted: WakeCapabilityProfile = {
      ...profile,
      movementLevel: "none",
      availableResources: [],
      excludedTaskIds: ["memory", "stroop"],
    };
    const steps = selectRecoverySteps({
      primarySteps: [
        { index: 0, taskId: "math", category: "cognitive" },
        { index: 1, taskId: "reaction", category: "cognitive" },
      ],
      completedTaskIds: ["math", "reaction"],
      rejectedTaskIds: ["memory", "stroop"],
      profile: restricted,
    });

    expect(steps).toEqual([]);
  });
});
