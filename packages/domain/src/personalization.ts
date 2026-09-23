import type {
  AdaptiveProtocolEvidence,
  ExperimentAssignment,
  ProtocolStep,
  TaskId,
  WakeCapabilityProfile,
  WakeDurationMinutes,
  WakePersonalizationSnapshot,
  WakeContext,
} from "./model.js";
import { estimatedTaskSeconds } from "./task-policy.js";

export const SAFE_WAKE_PROFILE: WakeCapabilityProfile = {
  movementLevel: "none",
  availableResources: [],
  excludedTaskIds: [],
  defaultDurationMinutes: 5,
  onboardingCompleted: false,
  revision: 0,
};

const FALLBACK_ORDER: readonly TaskId[] = ["reaction", "stroop", "memory", "math", "shake"];
const BUDGET_EXPANSION_ORDER: readonly TaskId[] = [
  "window",
  "water",
  "reaction",
  "stroop",
  "math",
  "memory",
  "shake",
  "steps",
  "squats",
];
const ACTIVE_TASK_IDS = new Set<TaskId>([
  "steps",
  "squats",
  "shake",
  "water",
  "window",
  "curtains",
]);
const STANDING_TASK_IDS = new Set<TaskId>([
  "steps",
  "squats",
  "shake",
  "water",
  "window",
  "curtains",
]);

function allowed(taskId: TaskId, profile: WakeCapabilityProfile): boolean {
  if (taskId === "sit_edge") return true;
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
  return (
    [
      "math",
      "memory",
      "stroop",
      "reaction",
      "steps",
      "squats",
      "shake",
      "water",
      "window",
    ] as TaskId[]
  ).filter((taskId) => allowed(taskId, profile));
}

function categoryForTask(taskId: TaskId): ProtocolStep["category"] {
  if (taskId === "steps" || taskId === "squats" || taskId === "shake" || taskId === "sit_edge") {
    return "movement";
  }
  if (taskId === "water") return "behavioral";
  if (taskId === "window" || taskId === "curtains") return "environment";
  return "cognitive";
}

function withStandingTransition(steps: readonly ProtocolStep[]): ProtocolStep[] {
  const withoutTransition = steps.filter(({ taskId }) => taskId !== "sit_edge");
  const firstStandingIndex = withoutTransition.findIndex(({ taskId }) =>
    STANDING_TASK_IDS.has(taskId),
  );
  if (firstStandingIndex < 0) {
    return withoutTransition.map((step, index) => ({ ...step, index }));
  }
  const result = [...withoutTransition];
  result.splice(firstStandingIndex, 0, {
    index: firstStandingIndex,
    taskId: "sit_edge",
    category: "movement",
  });
  return result.map((step, index) => ({ ...step, index }));
}

export function plannedProtocolSeconds(
  steps: readonly ProtocolStep[],
  durationMinutes: WakeDurationMinutes,
): number {
  return steps.reduce(
    (total, { taskId }) => total + estimatedTaskSeconds(taskId, durationMinutes),
    0,
  );
}

function planForDuration(
  seed: readonly ProtocolStep[],
  profile: WakeCapabilityProfile,
  durationMinutes: WakeDurationMinutes,
  rotationSeed = 0,
): { steps: ProtocolStep[]; belowMinimum: boolean } {
  const minimumSeconds = durationMinutes * 60 * 0.9;
  const maximumSeconds = durationMinutes * 60 * 1.1;
  let selected: ProtocolStep[] = [];
  const used = new Set<TaskId>();

  const tryAppend = (step: ProtocolStep): boolean => {
    if (step.taskId === "sit_edge" || used.has(step.taskId) || !allowed(step.taskId, profile)) {
      return false;
    }
    const candidate = withStandingTransition([...selected, step]);
    if (plannedProtocolSeconds(candidate, durationMinutes) > maximumSeconds) return false;
    selected = candidate;
    used.add(step.taskId);
    return true;
  };

  for (const step of seed) tryAppend(step);
  const rotation = rotationSeed % BUDGET_EXPANSION_ORDER.length;
  const expansionOrder = [
    ...BUDGET_EXPANSION_ORDER.slice(rotation),
    ...BUDGET_EXPANSION_ORDER.slice(0, rotation),
  ];
  for (const taskId of expansionOrder) {
    if (plannedProtocolSeconds(selected, durationMinutes) >= minimumSeconds) break;
    tryAppend({ index: selected.length, taskId, category: categoryForTask(taskId) });
  }

  selected = withStandingTransition(selected);
  return {
    steps: selected,
    belowMinimum: plannedProtocolSeconds(selected, durationMinutes) < minimumSeconds,
  };
}

function placeSquatsAfterWarmup(steps: readonly ProtocolStep[]): ProtocolStep[] {
  const result = [...steps];
  const squatsIndex = result.findIndex(({ taskId }) => taskId === "squats");
  if (squatsIndex < 0) return result;
  const warmupIndex = result.findIndex(({ taskId }) => taskId === "steps" || taskId === "shake");
  if (warmupIndex < 0 || warmupIndex < squatsIndex) return result;
  const [squats] = result.splice(squatsIndex, 1);
  const movedWarmupIndex = result.findIndex(
    ({ taskId }) => taskId === "steps" || taskId === "shake",
  );
  result.splice(movedWarmupIndex + 1, 0, squats!);
  return result;
}

export function personalizeAssignment(
  assignment: ExperimentAssignment,
  profile: WakeCapabilityProfile,
  durationMinutes: WakeDurationMinutes,
): { assignment: ExperimentAssignment; snapshot: WakePersonalizationSnapshot } {
  const rotationSeed = [...assignment.protocolKey].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  const eligible = assignment.steps.filter((step) => allowed(step.taskId, profile));
  let planned = planForDuration(
    placeSquatsAfterWarmup(eligible),
    profile,
    durationMinutes,
    rotationSeed,
  );
  let steps = planned.steps;
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
    planned = planForDuration(fallback, profile, durationMinutes, rotationSeed);
    steps = planned.steps;
    fallbackReason = "limited_eligible_tasks";
  } else if (eligible.length !== assignment.steps.length) {
    fallbackReason = "limited_eligible_tasks";
  }

  if (planned.belowMinimum) fallbackReason = "limited_eligible_tasks";

  if (durationMinutes >= 5 && !steps.some((step) => ACTIVE_TASK_IDS.has(step.taskId))) {
    const active = eligibleWakeTasks(profile)
      .filter((taskId) => ACTIVE_TASK_IDS.has(taskId) && allowed(taskId, profile))
      .find((taskId) => !steps.some((step) => step.taskId === taskId));
    if (active) {
      const category: ProtocolStep["category"] =
        active === "steps" || active === "squats" || active === "shake"
          ? "movement"
          : active === "water"
            ? "behavioral"
            : "environment";
      steps = planForDuration(
        [...steps, { index: steps.length, taskId: active, category }],
        profile,
        durationMinutes,
        rotationSeed,
      ).steps;
    }
  }

  const suffix = steps.map(({ taskId }) => taskId).join("-") || "safe";
  const { comparison, ...baseAssignment } = assignment;
  const preserveComparison = steps.length === assignment.steps.length && comparison !== undefined;
  return {
    assignment: {
      ...baseAssignment,
      protocolVersion: Math.max(8, assignment.protocolVersion),
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
  adaptive?: {
    evidence: readonly AdaptiveProtocolEvidence[];
    wakeContext: WakeContext;
    completedSessions: number;
  },
): { assignment: ExperimentAssignment; snapshot: WakePersonalizationSnapshot } {
  if (candidates.length === 0) throw new Error("At least one assignment candidate is required");
  const personalizedBySequence = new Map<
    string,
    { assignment: ExperimentAssignment; snapshot: WakePersonalizationSnapshot }
  >();
  for (const candidate of candidates) {
    const value = personalizeAssignment(candidate, profile, durationMinutes);
    const signature = value.assignment.steps.map(({ taskId }) => taskId).join(">");
    if (!personalizedBySequence.has(signature)) personalizedBySequence.set(signature, value);
  }
  const personalized = [...personalizedBySequence.values()];
  const previousSignature = previousTaskIds.join(",");
  const withoutImmediateRepeat = personalized.filter(
    ({ assignment }) =>
      assignment.steps.map(({ taskId }) => taskId).join(",") !== previousSignature,
  );
  const available = withoutImmediateRepeat.length > 0 ? withoutImmediateRepeat : personalized;
  if (!adaptive || !candidates.some(({ phase }) => phase === "adaptive")) {
    return available[0]!;
  }

  const comparable = adaptive.evidence.filter(
    (item) => item.wakeContext === adaptive.wakeContext && item.durationMinutes === durationMinutes,
  );
  const summaries = available.map((value, order) => {
    const sequenceKey = value.assignment.steps.map(({ taskId }) => taskId).join(">");
    const observations = comparable.filter((item) => item.sequenceKey === sequenceKey);
    const deltas = observations.map(({ baseline, postRating }) => postRating - baseline);
    const followUps = observations.flatMap(({ followUp }) =>
      followUp === null ? [] : [followUp === "up" ? 0.5 : followUp === "back" ? -0.5 : -0.15],
    );
    const averageDelta =
      deltas.length === 0 ? null : deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
    const followUpScore =
      followUps.length === 0
        ? 0
        : followUps.reduce((sum, score) => sum + score, 0) / followUps.length;
    return {
      ...value,
      order,
      sequenceKey,
      evidenceCount: observations.length,
      score: averageDelta === null ? Number.NEGATIVE_INFINITY : averageDelta + followUpScore,
    };
  });
  const byLeastEvidence = (left: (typeof summaries)[number], right: (typeof summaries)[number]) =>
    left.evidenceCount - right.evidenceCount || left.order - right.order;
  const byBestScore = (left: (typeof summaries)[number], right: (typeof summaries)[number]) =>
    right.score - left.score ||
    right.evidenceCount - left.evidenceCount ||
    left.order - right.order;
  const unseen = summaries.filter(({ evidenceCount }) => evidenceCount === 0).sort(byLeastEvidence);
  const underVerified = summaries
    .filter(({ evidenceCount }) => evidenceCount > 0 && evidenceCount < 2)
    .sort(byLeastEvidence);
  const selectionMode =
    unseen.length > 0 || underVerified.length > 0
      ? "explore"
      : adaptive.completedSessions % 3 === 0
        ? "explore"
        : "best";
  const selected =
    unseen[0] ??
    underVerified[0] ??
    (selectionMode === "explore"
      ? [...summaries].sort(byLeastEvidence)[0]
      : [...summaries].sort(byBestScore)[0]) ??
    summaries[0]!;
  const hypothesis =
    selectionMode === "best"
      ? `Повторно проверяем лучший наблюдаемый вариант (${selected.evidenceCount} наблюдения)`
      : selected.evidenceCount === 0
        ? "Проверяем новый допустимый вариант, чтобы найти более подходящий протокол"
        : `Уточняем результат малоизученного варианта (${selected.evidenceCount} наблюдение)`;
  return {
    ...selected,
    assignment: { ...selected.assignment, hypothesis, phase: "adaptive" },
  };
}
