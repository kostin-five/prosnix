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
    protocolVersion: 1,
    strategyVersion: "learning-v1",
    phase: "learning",
    hypothesis,
    steps,
    ...(comparison ? { comparison } : {}),
  };
}

const LEARNING_ASSIGNMENTS: readonly PlannedAssignment[] = [
  plan("cognitive-baseline", "Измеряем стартовую реакцию на короткий когнитивный протокол", CORE),
  plan(
    "movement-plus",
    "Проверяем, усиливает ли короткое движение эффект того же когнитивного протокола",
    [...CORE, { index: 2, taskId: "steps", category: "movement" }],
    { groupKey: "movement-a", factorKey: "movement", level: "with" },
  ),
  plan("cognitive-core", "Контрольное наблюдение без движения", CORE, {
    groupKey: "movement-a",
    factorKey: "movement",
    level: "without",
  }),
  plan(
    "movement-plus",
    "Повторяем наблюдение с движением для независимого сравнения",
    [...CORE, { index: 2, taskId: "steps", category: "movement" }],
    { groupKey: "movement-a", factorKey: "movement", level: "with" },
  ),
  plan("cognitive-core", "Повторяем контрольное наблюдение без движения", CORE, {
    groupKey: "movement-a",
    factorKey: "movement",
    level: "without",
  }),
  plan(
    "movement-plus",
    "Завершаем третье независимое наблюдение с движением",
    [...CORE, { index: 2, taskId: "steps", category: "movement" }],
    { groupKey: "movement-a", factorKey: "movement", level: "with" },
  ),
  plan("cognitive-core", "Завершаем третье контрольное наблюдение без движения", CORE, {
    groupKey: "movement-a",
    factorKey: "movement",
    level: "without",
  }),
];

const FALLBACK: PlannedAssignment = {
  protocolKey: "safe-fallback",
  protocolVersion: 1,
  strategyVersion: "fallback-v1",
  phase: "fallback",
  hypothesis: "Используем безопасный протокол, пока персональных данных недостаточно",
  steps: [
    { index: 0, taskId: "steps", category: "movement" },
    { index: 1, taskId: "window", category: "environment" },
    { index: 2, taskId: "water", category: "behavioral" },
  ],
};

const CONTINUATION_ASSIGNMENTS: readonly PlannedAssignment[] = [
  FALLBACK,
  {
    protocolKey: "cognitive-refresh",
    protocolVersion: 1,
    strategyVersion: "continuation-v1",
    phase: "fallback",
    hypothesis: "Меняем порядок коротких когнитивных заданий для следующего наблюдения",
    steps: [
      { index: 0, taskId: "reaction", category: "cognitive" },
      { index: 1, taskId: "memory", category: "cognitive" },
      { index: 2, taskId: "stroop", category: "cognitive" },
      { index: 3, taskId: "math", category: "cognitive" },
    ],
  },
  {
    protocolKey: "activation-mix",
    protocolVersion: 1,
    strategyVersion: "continuation-v1",
    phase: "fallback",
    hypothesis: "Проверяем другую последовательность доступных действий",
    steps: [
      { index: 0, taskId: "shake", category: "movement" },
      { index: 1, taskId: "stroop", category: "cognitive" },
      { index: 2, taskId: "math", category: "cognitive" },
      { index: 3, taskId: "water", category: "behavioral" },
      { index: 4, taskId: "window", category: "environment" },
    ],
  },
];

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
  return rotate(CONTINUATION_ASSIGNMENTS, completedLearningSessions - LEARNING_ASSIGNMENTS.length);
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
