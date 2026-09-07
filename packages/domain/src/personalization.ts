import type {
  ExperimentAssignment,
  ProtocolStep,
  TaskId,
  WakeCapabilityProfile,
  WakeDurationMinutes,
  WakePersonalizationSnapshot,
} from "./model.js";

export const SAFE_WAKE_PROFILE: WakeCapabilityProfile = {
  movementLevel: "none",
  availableResources: [],
  excludedTaskIds: [],
  defaultDurationMinutes: 5,
  onboardingCompleted: false,
  revision: 0,
};

const ESTIMATED_SECONDS: Record<TaskId, number> = {
  math: 60,
  memory: 60,
  stroop: 45,
  reaction: 30,
  steps: 30,
  squats: 30,
  shake: 20,
  water: 45,
  window: 40,
  curtains: 20,
};

const FALLBACK_ORDER: readonly TaskId[] = ["reaction", "stroop", "memory", "math", "shake"];
const ACTIVE_TASK_IDS = new Set<TaskId>([
  "steps",
  "squats",
  "shake",
  "water",
  "window",
  "curtains",
]);

function allowed(taskId: TaskId, profile: WakeCapabilityProfile): boolean {
  if (profile.excludedTaskIds.includes(taskId)) return false;
  if (taskId === "squats") {
    return profile.movementLevel === "full" && profile.availableResources.includes("floor_space");
  }
  if (taskId === "steps" || taskId === "shake") return profile.movementLevel !== "none";
  if (taskId === "water") return profile.availableResources.includes("water");
  if (taskId === "window" || taskId === "curtains") {
    return profile.availableResources.includes("bright_light");
  }
  return true;
}

export function eligibleWakeTasks(profile: WakeCapabilityProfile): TaskId[] {
  return (Object.keys(ESTIMATED_SECONDS) as TaskId[]).filter((taskId) => allowed(taskId, profile));
}

function fitBudget(
  steps: readonly ProtocolStep[],
  durationMinutes: WakeDurationMinutes,
): ProtocolStep[] {
  const maximumSeconds = durationMinutes * 60 + 30;
  let elapsed = 0;
  const selected: ProtocolStep[] = [];
  for (const step of steps) {
    const estimate = ESTIMATED_SECONDS[step.taskId];
    if (elapsed + estimate > maximumSeconds) continue;
    selected.push(step);
    elapsed += estimate;
  }
  return selected.map((step, index) => ({ ...step, index }));
}

export function personalizeAssignment(
  assignment: ExperimentAssignment,
  profile: WakeCapabilityProfile,
  durationMinutes: WakeDurationMinutes,
): { assignment: ExperimentAssignment; snapshot: WakePersonalizationSnapshot } {
  const eligible = assignment.steps.filter((step) => allowed(step.taskId, profile));
  let steps = fitBudget(eligible, durationMinutes);
  let fallbackReason: WakePersonalizationSnapshot["fallbackReason"] = profile.onboardingCompleted
    ? "none"
    : "profile_missing";

  if (steps.length === 0) {
    const byId = new Map(assignment.steps.map((step) => [step.taskId, step.category]));
    const fallback = FALLBACK_ORDER.filter((taskId) => allowed(taskId, profile)).map(
      (taskId, index): ProtocolStep => ({
        index,
        taskId,
        category: byId.get(taskId) ?? (taskId === "shake" ? "movement" : "cognitive"),
      }),
    );
    steps = fitBudget(fallback, durationMinutes).slice(0, 2);
    fallbackReason = "limited_eligible_tasks";
  } else if (eligible.length !== assignment.steps.length) {
    fallbackReason = "limited_eligible_tasks";
  }

  if (durationMinutes >= 5 && !steps.some((step) => ACTIVE_TASK_IDS.has(step.taskId))) {
    const active = (Object.keys(ESTIMATED_SECONDS) as TaskId[])
      .filter((taskId) => ACTIVE_TASK_IDS.has(taskId) && allowed(taskId, profile))
      .find((taskId) => !steps.some((step) => step.taskId === taskId));
    if (active) {
      const category: ProtocolStep["category"] =
        active === "steps" || active === "squats" || active === "shake"
          ? "movement"
          : active === "water"
            ? "behavioral"
            : "environment";
      steps = fitBudget(
        [...steps, { index: steps.length, taskId: active, category }],
        durationMinutes,
      );
    }
  }

  const suffix = steps.map(({ taskId }) => taskId).join("-") || "safe";
  const { comparison, ...baseAssignment } = assignment;
  const preserveComparison = steps.length === assignment.steps.length && comparison !== undefined;
  return {
    assignment: {
      ...baseAssignment,
      protocolKey: `${assignment.protocolKey}:${durationMinutes}m:${suffix}`,
      steps,
      ...(preserveComparison ? { comparison } : {}),
      phase: fallbackReason === "limited_eligible_tasks" ? "fallback" : assignment.phase,
      hypothesis:
        fallbackReason === "limited_eligible_tasks"
          ? "Безопасный протокол с учётом твоих условий"
          : assignment.hypothesis,
    },
    snapshot: {
      profileRevision: profile.revision,
      movementLevel: profile.movementLevel,
      availableResources: [...profile.availableResources],
      excludedTaskIds: [...profile.excludedTaskIds],
      fallbackReason,
    },
  };
}

export function selectPersonalizedAssignment(
  candidates: readonly ExperimentAssignment[],
  profile: WakeCapabilityProfile,
  durationMinutes: WakeDurationMinutes,
  previousTaskIds: readonly TaskId[] = [],
): { assignment: ExperimentAssignment; snapshot: WakePersonalizationSnapshot } {
  if (candidates.length === 0) throw new Error("At least one assignment candidate is required");
  const personalized = candidates.map((candidate) =>
    personalizeAssignment(candidate, profile, durationMinutes),
  );
  const previousSignature = previousTaskIds.join(",");
  return (
    personalized.find(
      ({ assignment }) =>
        assignment.steps.map(({ taskId }) => taskId).join(",") !== previousSignature,
    ) ?? personalized[0]!
  );
}
