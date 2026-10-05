import type { ExperimentAssignment, ProtocolStep, TaskId } from "../model.js";

export type PlannedAssignment = Omit<ExperimentAssignment, "id">;

function plan(
  protocolKey: string,
  hypothesis: string,
  steps: readonly ProtocolStep[],
  comparison?: ExperimentAssignment["comparison"],
): PlannedAssignment {
  return {
    protocolKey,
    protocolVersion: 7,
    strategyVersion: "learning-v8",
    phase: "learning",
    hypothesis,
    steps,
    ...(comparison ? { comparison } : {}),
  };
}

const LEARNING_ASSIGNMENTS: readonly PlannedAssignment[] = [
  plan("calibration-cognitive-water", "Проверяем когнитивное включение со стаканом воды", [
    { index: 0, taskId: "math", category: "cognitive" },
    { index: 1, taskId: "memory", category: "cognitive" },
    { index: 2, taskId: "stroop", category: "cognitive" },
    { index: 3, taskId: "reaction", category: "cognitive" },
    { index: 4, taskId: "water", category: "behavioral" },
  ]),
  plan("calibration-movement-light", "Проверяем мягкое и интенсивное движение после света", [
    { index: 0, taskId: "window", category: "environment" },
    { index: 1, taskId: "shake", category: "movement" },
    { index: 2, taskId: "steps", category: "movement" },
    { index: 3, taskId: "squats", category: "movement" },
    { index: 4, taskId: "math", category: "cognitive" },
  ]),
  plan("calibration-environment-focus", "Проверяем задачи после воды и яркого света", [
    { index: 0, taskId: "memory", category: "cognitive" },
    { index: 1, taskId: "stroop", category: "cognitive" },
    { index: 2, taskId: "reaction", category: "cognitive" },
    { index: 3, taskId: "water", category: "behavioral" },
    { index: 4, taskId: "window", category: "environment" },
  ]),
  plan("calibration-movement-memory", "Проверяем движение перед математикой и памятью", [
    { index: 0, taskId: "shake", category: "movement" },
    { index: 1, taskId: "steps", category: "movement" },
    { index: 2, taskId: "pushups", category: "movement" },
    { index: 3, taskId: "math", category: "cognitive" },
    { index: 4, taskId: "memory", category: "cognitive" },
  ]),
  plan("calibration-light-reset", "Проверяем внимание и реакцию со светом и разминкой", [
    { index: 0, taskId: "stroop", category: "cognitive" },
    { index: 1, taskId: "reaction", category: "cognitive" },
    { index: 2, taskId: "water", category: "behavioral" },
    { index: 3, taskId: "window", category: "environment" },
    { index: 4, taskId: "shake", category: "movement" },
  ]),
  plan("calibration-standing-focus", "Проверяем стоячее движение перед задачами", [
    { index: 0, taskId: "steps", category: "movement" },
    { index: 1, taskId: "squats", category: "movement" },
    { index: 2, taskId: "math", category: "cognitive" },
    { index: 3, taskId: "memory", category: "cognitive" },
    { index: 4, taskId: "stroop", category: "cognitive" },
  ]),
  plan("calibration-active-light", "Проверяем реакцию после воды, света и движения", [
    { index: 0, taskId: "reaction", category: "cognitive" },
    { index: 1, taskId: "water", category: "behavioral" },
    { index: 2, taskId: "window", category: "environment" },
    { index: 3, taskId: "shake", category: "movement" },
    { index: 4, taskId: "steps", category: "movement" },
  ]),
];

const FALLBACK: PlannedAssignment = {
  protocolKey: "safe-fallback",
  protocolVersion: 7,
  strategyVersion: "fallback-v6",
  phase: "fallback",
  hypothesis: "Используем безопасный протокол, пока персональных данных недостаточно",
  steps: [
    { index: 0, taskId: "steps", category: "movement" },
    { index: 1, taskId: "window", category: "environment" },
    { index: 2, taskId: "water", category: "behavioral" },
  ],
};

const ADAPTIVE_ASSIGNMENTS: readonly PlannedAssignment[] = [
  plan("adaptive-cognitive-water", "Проверяем когнитивный вариант после воды", [
    { index: 0, taskId: "water", category: "behavioral" },
    { index: 1, taskId: "math", category: "cognitive" },
    { index: 2, taskId: "reaction", category: "cognitive" },
    { index: 3, taskId: "stroop", category: "cognitive" },
    { index: 4, taskId: "memory", category: "cognitive" },
  ]),
  plan("adaptive-standing-light", "Проверяем свет и последовательное движение", [
    { index: 0, taskId: "window", category: "environment" },
    { index: 1, taskId: "shake", category: "movement" },
    { index: 2, taskId: "steps", category: "movement" },
    { index: 3, taskId: "squats", category: "movement" },
    { index: 4, taskId: "math", category: "cognitive" },
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
  plan("adaptive-mixed-reset", "Проверяем разминку между задачами и водой", [
    { index: 0, taskId: "shake", category: "movement" },
    { index: 1, taskId: "reaction", category: "cognitive" },
    { index: 2, taskId: "water", category: "behavioral" },
    { index: 3, taskId: "math", category: "cognitive" },
    { index: 4, taskId: "stroop", category: "cognitive" },
  ]),
  plan("adaptive-standing-memory", "Проверяем движение перед памятью и математикой", [
    { index: 0, taskId: "steps", category: "movement" },
    { index: 1, taskId: "pushups", category: "movement" },
    { index: 2, taskId: "memory", category: "cognitive" },
    { index: 3, taskId: "math", category: "cognitive" },
    { index: 4, taskId: "window", category: "environment" },
  ]),
  plan("adaptive-active-light", "Проверяем сочетание света, движения и воды", [
    { index: 0, taskId: "window", category: "environment" },
    { index: 1, taskId: "shake", category: "movement" },
    { index: 2, taskId: "steps", category: "movement" },
    { index: 3, taskId: "squats", category: "movement" },
    { index: 4, taskId: "water", category: "behavioral" },
  ]),
].map((assignment) => ({
  ...assignment,
  protocolVersion: 7,
  strategyVersion: "adaptive-v8",
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
