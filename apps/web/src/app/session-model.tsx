import { Activity, Check } from "lucide-react";
import type { WakeSoundMode } from "../features/tasks/task-experience-feedback.js";
import type { BootstrapResponse, WakeSessionResponse } from "../shared/api/client.js";
const GUIDED_TASK_EXPERIENCE_ENABLED =
  import.meta.env.VITE_GUIDED_TASK_EXPERIENCE_ENABLED !== "false";

export type Screen =
  | "home"
  | "onboarding"
  | "context"
  | "startRating"
  | "tasks"
  | "endRating"
  | "results"
  | "stats"
  | "settings";
export type TaskId =
  | "math"
  | "memory"
  | "stroop"
  | "reaction"
  | "steps"
  | "squats"
  | "shake"
  | "water"
  | "window"
  | "curtains"
  | "sit_edge"
  | "cool_wash"
  | "pushups"
  | "notice_three"
  | "find_color"
  | "breathing";
export type TaskCategory = "cognitive" | "movement" | "behavioral" | "environment";
export type FollowUp = "up" | "back" | "drowsy" | null;

export function sendTaskFeedback(
  kind: "start" | "cue" | "success" | "error",
  soundMode: WakeSoundMode,
): void {
  if (!GUIDED_TASK_EXPERIENCE_ENABLED) return;
  void import("../features/tasks/task-experience-feedback.js").then(({ signalTaskFeedback }) => {
    signalTaskFeedback(kind, soundMode);
  });
}

export interface TaskResult {
  id: TaskId;
  category: TaskCategory;
  correct: number;
  total: number;
  timeMs: number;
  difficultyLevel?: number;
  completionSource?: "manual" | "timer";
}

export interface Session {
  completedEarly?: boolean;
  id: string;
  date: string;
  wakeTime: string;
  startAlertness: number; // 1–10: 1 = barely awake, 10 = fully alert
  tasks: TaskResult[];
  endAlertness: number; // same scale
  followUp: FollowUp;
  totalMs: number;
  sessionKind?: "primary" | "recovery";
  parentSessionId?: string | null;
  recoveryOffer?: WakeSessionResponse["recoveryOffer"];
}

export function resumedServerSession(
  resume: NonNullable<BootstrapResponse["activeSession"]>,
): WakeSessionResponse {
  return {
    id: resume.session.id,
    userId: "",
    status: resume.session.status,
    currentStepIndex: resume.session.currentStepIndex,
    version: resume.session.version,
    wakeContext: resume.session.wakeContext,
    durationMinutes: resume.session.durationMinutes,
    personalization: resume.session.personalization,
    sessionKind: resume.session.sessionKind,
    parentSessionId: resume.session.parentSessionId,
    recoveryBaseline: resume.session.recoveryBaseline,
    recoveryOffer: resume.session.recoveryOffer,
    experience: resume.session.experience,
    assignment: {
      id: resume.session.id,
      protocolKey: resume.protocol.key,
      protocolVersion: resume.protocol.version,
      strategyVersion: resume.assignment.strategyVersion,
      phase: resume.assignment.phase,
      hypothesis: resume.assignment.hypothesis,
      steps: resume.protocol.steps
        .filter((step) => step.category !== undefined)
        .map((step) => ({
          index: step.index,
          taskId: step.taskId,
          category: step.category as TaskCategory,
        })),
    },
    effectiveSteps: (resume.protocol.effectiveSteps ?? resume.protocol.steps)
      .filter((step) => step.category !== undefined)
      .map((step) => ({
        index: step.index,
        taskId: step.taskId,
        category: step.category as TaskCategory,
      })),
    substitutions: resume.substitutions,
    baseline: resume.baseline,
    tasks: [],
    postRating: resume.postRating,
    followUp: null,
    startedAt: null,
    protocolCompletedAt: null,
    followUpDueAt: null,
    abandonedAt: null,
  };
}

export function screenForSession(session: WakeSessionResponse, taskCount: number): Screen {
  if (session.baseline === null) return "startRating";
  if (session.currentStepIndex >= taskCount) return "endRating";
  return "tasks";
}

export function initialProtocolScreen(
  resume: NonNullable<BootstrapResponse["activeSession"]> | undefined,
  launchSource: string | null,
  onboardingCompleted = true,
): Screen {
  if (!resume && !onboardingCompleted) return "onboarding";
  if (!resume) return launchSource === "wake" ? "startRating" : "home";
  if (resume.baseline === null) return "startRating";
  const taskCount = resume.protocol.steps.filter((step) => step.category !== undefined).length;
  if (resume.session.currentStepIndex >= taskCount) return "endRating";
  return "tasks";
}

// ─── Task Pool ────────────────────────────────────────────────────────────────
export const TASK_META: Record<
  TaskId,
  { category: TaskCategory; title: string; subtitle: string }
> = {
  breathing: {
    category: "behavioral",
    title: "Спокойное дыхание",
    subtitle: "В удобном ритме · 30 секунд",
  },
  math: { category: "cognitive", title: "Математика", subtitle: "Арифметика в уме" },
  memory: {
    category: "cognitive",
    title: "Память",
    subtitle: "Запомни и воспроизведи",
  },
  stroop: { category: "cognitive", title: "Внимание", subtitle: "Тест Струпа" },
  reaction: { category: "cognitive", title: "Реакция", subtitle: "Поймай момент" },
  steps: { category: "movement", title: "Пройтись", subtitle: "20–30 секунд ходьбы" },
  squats: { category: "movement", title: "Приседания", subtitle: "5 приседаний" },
  shake: {
    category: "movement",
    title: "Разминка",
    subtitle: "Короткая разминка тела",
  },
  water: { category: "behavioral", title: "Стакан воды", subtitle: "Выпить воду" },
  window: {
    category: "environment",
    title: "Яркий свет",
    subtitle: "Открыть шторы или включить свет",
  },
  curtains: {
    category: "environment",
    title: "Открыть шторы",
    subtitle: "Впустить утренний свет",
  },
  sit_edge: {
    category: "movement",
    title: "Сесть на край кровати",
    subtitle: "Стопы на полу · 10 секунд",
  },
  cool_wash: {
    category: "behavioral",
    title: "Умыться прохладной водой",
    subtitle: "20 секунд у раковины",
  },
  pushups: {
    category: "movement",
    title: "Отжимания",
    subtitle: "От пола или с колен",
  },
  notice_three: {
    category: "behavioral",
    title: "Три предмета",
    subtitle: "Назови про себя три предмета вокруг",
  },
  find_color: {
    category: "environment",
    title: "Найди цвет",
    subtitle: "Найди пять предметов одного цвета",
  },
};

export const CAT_META: Record<TaskCategory, { label: string; color: string; bg: string }> = {
  cognitive: { label: "Когнитивные", color: "text-accent", bg: "bg-accent/10" },
  movement: { label: "Движение", color: "text-green-400", bg: "bg-green-500/10" },
  behavioral: { label: "Поведение", color: "text-blue-400", bg: "bg-blue-500/10" },
  environment: { label: "Окружение", color: "text-yellow-400", bg: "bg-yellow-500/10" },
};

export function FollowUpIcon({
  answer,
  className = "h-5 w-5",
}: {
  answer: Exclude<FollowUp, null>;
  className?: string;
}) {
  if (answer === "up") return <Check className={className} />;
  if (answer === "back") return <MoonIcon className={className} />;
  return <Activity className={className} />;
}

function MoonIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z" />
    </svg>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────
export function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const STROOP = [
  { label: "Красный", value: "red", cls: "text-red-400" },
  { label: "Синий", value: "blue", cls: "text-blue-400" },
  { label: "Зелёный", value: "green", cls: "text-green-400" },
  { label: "Жёлтый", value: "yell", cls: "text-yellow-300" },
];
export function makeStroopQs() {
  return Array.from({ length: 3 }, () => {
    const word = STROOP[rand(0, 3)];
    let ink = STROOP[rand(0, 3)];
    while (ink.value === word.value) ink = STROOP[rand(0, 3)];
    const opts = [ink, ...STROOP.filter((c) => c.value !== ink.value).slice(0, 2)].sort(
      () => Math.random() - 0.5,
    );
    return {
      word: word.label.toUpperCase(),
      inkClass: ink.cls,
      answer: ink.value,
      options: opts.map((o) => ({ label: o.label, value: o.value })),
    };
  });
}
