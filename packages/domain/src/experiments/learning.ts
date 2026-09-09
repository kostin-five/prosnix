import type { ExperimentAssignment, ProtocolStep, TaskId } from "../model.js";

export type PlannedAssignment = Omit<ExperimentAssignment, "id">;

const CORE: readonly ProtocolStep[] = [
  { index: 0, taskId: "math", category: "cognitive" },
  { index: 1, taskId: "memory", category: "cognitive" },
  { index: 2, taskId: "stroop", category: "cognitive" },
  { index: 3, taskId: "reaction", category: "cognitive" },
];

function plan(
  protocolKey: string,
  hypothesis: string,
  steps: readonly ProtocolStep[],
  comparison?: ExperimentAssignment["comparison"],
): PlannedAssignment {
  return {
    protocolKey,
    protocolVersion: 6,
    strategyVersion: "learning-v5",
    phase: "learning",
    hypothesis,
    steps,
    ...(comparison ? { comparison } : {}),
  };
}

const LEARNING_ASSIGNMENTS: readonly PlannedAssignment[] = [
  plan("cognitive-baseline", "Измеряем стартовую реакцию на короткий когнитивный протокол", CORE),
  plan("calibration-active-start", "Проверяем мягкое движение перед задачами", [
    { index: 0, taskId: "steps", category: "movement" },
    { index: 1, taskId: "reaction", category: "cognitive" },
    { index: 2, taskId: "math", category: "cognitive" },
    { index: 3, taskId: "memory", category: "cognitive" },
    { index: 4, taskId: "stroop", category: "cognitive" },
  ]),
  plan("calibration-environment-start", "Проверяем свет и воду перед задачами", [
    { index: 0, taskId: "window", category: "environment" },
    { index: 1, taskId: "water", category: "behavioral" },
    { index: 2, taskId: "memory", category: "cognitive" },
    { index: 3, taskId: "stroop", category: "cognitive" },
    { index: 4, taskId: "reaction", category: "cognitive" },
  ]),
  plan("calibration-warmup-focus", "Проверяем разминку перед последовательностью задач", [
    { index: 0, taskId: "shake", category: "movement" },
    { index: 1, taskId: "stroop", category: "cognitive" },
    { index: 2, taskId: "math", category: "cognitive" },
    { index: 3, taskId: "memory", category: "cognitive" },
    { index: 4, taskId: "reaction", category: "cognitive" },
  ]),
  plan("calibration-memory-focus", "Проверяем порядок с ранней задачей на память", [
    { index: 0, taskId: "water", category: "behavioral" },
    { index: 1, taskId: "memory", category: "cognitive" },
    { index: 2, taskId: "math", category: "cognitive" },
    { index: 3, taskId: "reaction", category: "cognitive" },
    { index: 4, taskId: "window", category: "environment" },
  ]),
  plan("calibration-fast-focus", "Проверяем быстрое включение через движение и реакцию", [
    { index: 0, taskId: "steps", category: "movement" },
    { index: 1, taskId: "reaction", category: "cognitive" },
    { index: 2, taskId: "stroop", category: "cognitive" },
    { index: 3, taskId: "memory", category: "cognitive" },
    { index: 4, taskId: "math", category: "cognitive" },
  ]),
  plan("calibration-mixed-reset", "Проверяем чередование света, движения и внимания", [
    { index: 0, taskId: "window", category: "environment" },
    { index: 1, taskId: "shake", category: "movement" },
    { index: 2, taskId: "stroop", category: "cognitive" },
    { index: 3, taskId: "memory", category: "cognitive" },
    { index: 4, taskId: "math", category: "cognitive" },
  ]),
];

const FALLBACK: PlannedAssignment = {
  protocolKey: "safe-fallback",
  protocolVersion: 6,
  strategyVersion: "fallback-v5",
  phase: "fallback",
  hypothesis: "Используем безопасный протокол, пока персональных данных недостаточно",
  steps: [
    { index: 0, taskId: "steps", category: "movement" },
    { index: 1, taskId: "window", category: "environment" },
    { index: 2, taskId: "water", category: "behavioral" },
  ],
};

const ADAPTIVE_ASSIGNMENTS: readonly PlannedAssignment[] = [
  plan("adaptive-active-start", "Проверяем активное начало перед задачами", [
    { index: 0, taskId: "steps", category: "movement" },
    { index: 1, taskId: "reaction", category: "cognitive" },
    { index: 2, taskId: "math", category: "cognitive" },
    { index: 3, taskId: "memory", category: "cognitive" },
    { index: 4, taskId: "water", category: "behavioral" },
  ]),
  plan("adaptive-fast-focus", "Проверяем быстрое когнитивное включение", [
    { index: 0, taskId: "reaction", category: "cognitive" },
    { index: 1, taskId: "stroop", category: "cognitive" },
    { index: 2, taskId: "math", category: "cognitive" },
    { index: 3, taskId: "memory", category: "cognitive" },
    { index: 4, taskId: "shake", category: "movement" },
  ]),
  plan(
    "adaptive-light-first",
    "Проверяем свет и воду перед когнитивной нагрузкой",
    [
      { index: 0, taskId: "window", category: "environment" },
      { index: 1, taskId: "water", category: "behavioral" },
      { index: 2, taskId: "memory", category: "cognitive" },
      { index: 3, taskId: "stroop", category: "cognitive" },
      { index: 4, taskId: "reaction", category: "cognitive" },
    ],
    { groupKey: "movement-b", factorKey: "movement", level: "without" },
  ),
  plan(
    "adaptive-light-movement",
    "Сравниваем тот же порядок с короткой ходьбой",
    [
      { index: 0, taskId: "window", category: "environment" },
      { index: 1, taskId: "water", category: "behavioral" },
      { index: 2, taskId: "steps", category: "movement" },
      { index: 3, taskId: "memory", category: "cognitive" },
      { index: 4, taskId: "stroop", category: "cognitive" },
      { index: 5, taskId: "reaction", category: "cognitive" },
    ],
    { groupKey: "movement-b", factorKey: "movement", level: "with" },
  ),
  plan("adaptive-movement-focus", "Проверяем более активное начало пробуждения", [
    { index: 0, taskId: "squats", category: "movement" },
    { index: 1, taskId: "steps", category: "movement" },
    { index: 2, taskId: "reaction", category: "cognitive" },
    { index: 3, taskId: "stroop", category: "cognitive" },
    { index: 4, taskId: "water", category: "behavioral" },
  ]),
  plan("adaptive-memory-focus", "Проверяем последовательность с фокусом на память", [
    { index: 0, taskId: "water", category: "behavioral" },
    { index: 1, taskId: "memory", category: "cognitive" },
    { index: 2, taskId: "math", category: "cognitive" },
    { index: 3, taskId: "reaction", category: "cognitive" },
    { index: 4, taskId: "window", category: "environment" },
  ]),
  plan("adaptive-mixed-reset", "Проверяем чередование среды, движения и внимания", [
    { index: 0, taskId: "window", category: "environment" },
    { index: 1, taskId: "shake", category: "movement" },
    { index: 2, taskId: "stroop", category: "cognitive" },
    { index: 3, taskId: "memory", category: "cognitive" },
    { index: 4, taskId: "math", category: "cognitive" },
  ]),
].map((assignment) => ({
  ...assignment,
  protocolVersion: 6,
  strategyVersion: "adaptive-v6",
  phase: "adaptive" as const,
}));

function rotate<T>(values: readonly T[], start: number): readonly T[] {
  const index = start % values.length;
  return [...values.slice(index), ...values.slice(0, index)];
}

export function learningAssignmentCandidates(
  completedLearningSessions: number,
): readonly PlannedAssignment[] {
  if (!Number.isInteger(completedLearningSessions) || completedLearningSessions < 0) {
    return [FALLBACK];
  }
  if (completedLearningSessions < LEARNING_ASSIGNMENTS.length) {
    return rotate(LEARNING_ASSIGNMENTS, completedLearningSessions);
  }
  return rotate(ADAPTIVE_ASSIGNMENTS, completedLearningSessions - LEARNING_ASSIGNMENTS.length);
}

export function selectLearningAssignment(
  completedLearningSessions: number,
  previousTaskIds: readonly TaskId[] = [],
): PlannedAssignment {
  const candidates = learningAssignmentCandidates(completedLearningSessions);
  const previousSignature = previousTaskIds.join(",");
  return (
    candidates.find(
      (candidate) => candidate.steps.map(({ taskId }) => taskId).join(",") !== previousSignature,
    ) ?? candidates[0]!
  );
}
