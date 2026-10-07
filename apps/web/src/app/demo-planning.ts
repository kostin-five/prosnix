// Synthetic demo planning only. Authenticated assignments and analytics belong to the server.
import {
  CAT_META,
  TASK_META,
  type TaskId,
  type TaskCategory,
  type TaskResult,
  type Session,
} from "./session-model.js";

// ─── Learning Period Sequences ────────────────────────────────────────────────
const LEARNING_SEQ: TaskId[][] = [
  ["math", "memory"], // 1: cognitive baseline
  ["steps", "stroop"], // 2: movement + cognitive
  ["water", "math", "reaction"], // 3: behavioral + cognitive
  ["steps", "squats", "stroop"], // 4: movement heavy
  ["window", "steps", "water"], // 5: environment + movement + behavioral
  ["math", "stroop", "memory"], // 6: cognitive variety
  ["steps", "water", "stroop"], // 7: movement + behavioral + cognitive
];

// ─── Mock Session History ─────────────────────────────────────────────────────
const mkTask = (id: TaskId, ms: number, err = 0): TaskResult => ({
  id,
  category: TASK_META[id].category,
  correct: Math.max(0, 3 - err),
  total: 3,
  timeMs: ms,
});

export const MOCK_SESSIONS: Session[] =
  import.meta.env.DEV || import.meta.env.MODE === "portfolio"
    ? [
        {
          id: "s1",
          date: "16 авг",
          wakeTime: "07:05",
          startAlertness: 3,
          tasks: [mkTask("math", 52000, 1), mkTask("memory", 38000, 0)],
          endAlertness: 5,
          followUp: "drowsy",
          totalMs: 210000,
        },
        {
          id: "s2",
          date: "17 авг",
          wakeTime: "07:00",
          startAlertness: 3,
          tasks: [mkTask("steps", 62000), mkTask("stroop", 28000, 1)],
          endAlertness: 8,
          followUp: "up",
          totalMs: 155000,
        },
        {
          id: "s3",
          date: "18 авг",
          wakeTime: "07:12",
          startAlertness: 2,
          tasks: [mkTask("water", 18000), mkTask("math", 65000, 2)],
          endAlertness: 5,
          followUp: "back",
          totalMs: 195000,
        },
        {
          id: "s4",
          date: "19 авг",
          wakeTime: "07:00",
          startAlertness: 2,
          tasks: [mkTask("steps", 58000), mkTask("squats", 42000), mkTask("stroop", 24000)],
          endAlertness: 9,
          followUp: "up",
          totalMs: 148000,
        },
        {
          id: "s5",
          date: "20 авг",
          wakeTime: "07:02",
          startAlertness: 3,
          tasks: [mkTask("window", 45000), mkTask("steps", 60000), mkTask("water", 12000)],
          endAlertness: 8,
          followUp: "up",
          totalMs: 138000,
        },
        {
          id: "s6",
          date: "21 авг",
          wakeTime: "07:08",
          startAlertness: 2,
          tasks: [mkTask("math", 70000, 3), mkTask("stroop", 38000, 2), mkTask("memory", 45000, 1)],
          endAlertness: 5,
          followUp: "back",
          totalMs: 228000,
        },
      ]
    : [];

export function computeCategoryEffectiveness(sessions: Session[]) {
  const cats: TaskCategory[] = ["cognitive", "movement", "behavioral", "environment"];
  return Object.fromEntries(
    cats.map((cat) => {
      const matching = sessions.filter((s) => s.tasks.some((t) => t.category === cat));
      if (!matching.length)
        return [cat, { avgDelta: 0, avgAlertness: 0, sessions: 0, backRate: 0 }];
      const deltas = matching.map((s) => s.endAlertness - s.startAlertness);
      const back = matching.filter((s) => s.followUp === "back").length;
      return [
        cat,
        {
          avgDelta: deltas.reduce((a, b) => a + b, 0) / deltas.length,
          avgAlertness: matching.reduce((a, s) => a + s.endAlertness, 0) / matching.length,
          sessions: matching.length,
          backRate: matching.filter((s) => s.followUp !== null).length
            ? back / matching.filter((s) => s.followUp !== null).length
            : 0,
        },
      ];
    }),
  ) as Record<
    TaskCategory,
    { avgDelta: number; avgAlertness: number; sessions: number; backRate: number }
  >;
}

export function computeNextPlan(sessions: Session[]): {
  taskIds: TaskId[];
  rationale: string;
  isLearning: boolean;
} {
  const valid = sessions.filter((s) => s.endAlertness > 0 && !s.completedEarly);
  if (valid.length < 3) {
    const idx = valid.length < LEARNING_SEQ.length ? valid.length : 0;
    return {
      taskIds: LEARNING_SEQ[idx % LEARNING_SEQ.length],
      rationale:
        "Продолжаем пробовать разные комбинации, чтобы найти, что работает именно для тебя.",
      isLearning: true,
    };
  }
  const eff = computeCategoryEffectiveness(valid);
  const sorted = (Object.entries(eff) as [TaskCategory, (typeof eff)[TaskCategory]][])
    .filter(([, d]) => d.sessions >= 2)
    .sort((a, b) => b[1].avgDelta - a[1].avgDelta);
  if (!sorted.length) {
    return {
      taskIds: LEARNING_SEQ[0],
      rationale: "Продолжаем изучать разные протоколы.",
      isLearning: true,
    };
  }
  const [bestCat, bestData] = sorted[0];
  const catFirst: Record<string, TaskId> = {
    movement: "steps",
    cognitive: "stroop",
    behavioral: "water",
    environment: "window",
  };
  const first = catFirst[bestCat] || "steps";
  const cognitive: TaskId = first === "stroop" ? "reaction" : "stroop";
  const plan: TaskId[] = [first, cognitive, "water"];
  return {
    taskIds: plan,
    rationale: `${CAT_META[bestCat as TaskCategory].label} пока показывает лучший результат — среднее улучшение +${bestData.avgDelta.toFixed(1)} балла. Добавим когнитивную нагрузку и воду.`,
    isLearning: false,
  };
}

export function selectTasks(sessionCount: number, allSessions: Session[]): TaskId[] {
  if (sessionCount < LEARNING_SEQ.length) return LEARNING_SEQ[sessionCount];
  const plan = computeNextPlan(allSessions);
  return plan.taskIds;
}
