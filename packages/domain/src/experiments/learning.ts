import type { ExperimentAssignment, ProtocolStep } from "../model.js";

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

export function selectLearningAssignment(completedLearningSessions: number): PlannedAssignment {
  if (
    Number.isInteger(completedLearningSessions) &&
    completedLearningSessions >= 0 &&
    completedLearningSessions < LEARNING_ASSIGNMENTS.length
  ) {
    return LEARNING_ASSIGNMENTS[completedLearningSessions] as PlannedAssignment;
  }
  return FALLBACK;
}
