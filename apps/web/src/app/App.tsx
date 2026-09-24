import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { estimatedTaskSeconds, taskSuccessTarget } from "@awc/domain";
import {
  Home,
  BarChart2,
  Flame,
  Brain,
  Check,
  TrendingUp,
  ArrowRight,
  Sun,
  Award,
  ChevronRight,
  Zap,
  Activity,
  Loader2,
  AlertCircle,
  Sparkles,
  Settings,
  RefreshCw,
} from "lucide-react";
import { useBootstrap } from "../features/bootstrap/use-bootstrap.js";
import { useAnalyticsProfile } from "../features/analytics/use-analytics.js";
import { useCoachInsight } from "../features/coach/use-coach-insight.js";
import { useSessionHistory } from "../features/history/use-session-history.js";
import {
  SessionConflictError,
  abandonWakeSession,
  createWakeSession,
  saveBaseline,
  saveFollowUp,
  savePostRating,
  saveTaskResult,
  substituteWakeTask,
} from "../features/session/session-api.js";
import type { BootstrapResponse, WakeSessionResponse } from "../shared/api/client.js";
import { saveWakeSchedule, type WakeSchedule } from "../features/schedule/schedule-api.js";
import { LegalGate } from "../features/legal/legal-gate.js";
import {
  saveWakeProfile,
  saveWakeRoutine,
} from "../features/personalization/personalization-api.js";
import type {
  WakeContext,
  WakeDurationMinutes,
  WakeProfile,
  WakeRoutine,
} from "../shared/api/client.js";
import {
  adaptDifficulty,
  makeMathQuestion,
  makeMemorySequence,
  type DifficultyLevel,
} from "../features/tasks/task-engine.js";
import { LazyBoundary } from "./lazy-boundary.js";
import { ProsnixBrand } from "../features/brand/prosnix-brand.js";
import { TaskIcon } from "../features/tasks/task-icon.js";
import {
  TaskSubmissionGate,
  taskSubmissionConflictMessage,
} from "../features/session/task-submission-gate.js";
import type { WakeSoundMode } from "../features/tasks/task-experience-feedback.js";
import type { TaskSubstitutionReason } from "../features/tasks/task-substitution-sheet.js";

const GOAL_CALIBRATION_ENABLED = import.meta.env.VITE_GOAL_CALIBRATION_ENABLED !== "false";
const GUIDED_TASK_EXPERIENCE_ENABLED =
  import.meta.env.VITE_GUIDED_TASK_EXPERIENCE_ENABLED !== "false";
const WAKE_TASK_SUBSTITUTION_ENABLED =
  import.meta.env.VITE_WAKE_TASK_SUBSTITUTION_ENABLED === "true";

const SettingsScreen = lazy(() => import("../features/settings/settings-screen.js"));
const StartRatingScreen = lazy(async () => ({
  default: (await import("../features/session/rating-screens.js")).StartRatingScreen,
}));
const EndRatingScreen = lazy(async () => ({
  default: (await import("../features/session/rating-screens.js")).EndRatingScreen,
}));
const HomeScreenPrompt = lazy(async () => ({
  default: (await import("../features/onboarding/home-screen-prompt.js")).HomeScreenPrompt,
}));
const CapabilityOnboardingScreen = lazy(
  () => import("../features/personalization/capability-onboarding-screen.js"),
);
const StatsResearchCards = lazy(() => import("../features/research/stats-research-cards.js"));
const TaskMotionVisual = lazy(() => import("../features/tasks/task-motion-visual.js"));
const TaskSoundToggle = lazy(() => import("../features/tasks/task-sound-toggle.js"));
const ProtocolSheet = lazy(() => import("../features/tasks/protocol-sheet.js"));
const TaskSubstitutionSheet = lazy(() => import("../features/tasks/task-substitution-sheet.js"));
const ConfirmTask = lazy(() => import("../features/tasks/confirm-task.js"));
const MorningExperienceSlot = lazy(
  () => import("../features/personalization/morning-experience-slot.js"),
);
const WakeProfileSummary = lazy(() => import("../features/analytics/wake-profile-summary.js"));
const PixGuide = lazy(() => import("../features/brand/pix-guide.js"));
const WakeContextSheet = lazy(async () => ({
  default: (await import("../features/personalization/wake-context-sheet.js")).WakeContextSheet,
}));
const WakeRoutineChecklist = lazy(async () => ({
  default: (await import("../features/personalization/wake-routine-card.js")).WakeRoutineChecklist,
}));

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen =
  | "home"
  | "onboarding"
  | "context"
  | "startRating"
  | "tasks"
  | "endRating"
  | "results"
  | "stats"
  | "settings";
type TaskId =
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
  | "pushups";
type TaskCategory = "cognitive" | "movement" | "behavioral" | "environment";
type FollowUp = "up" | "back" | "drowsy" | null;
type Confidence = "insufficient" | "low" | "medium" | "high";

function sendTaskFeedback(
  kind: "start" | "cue" | "success" | "error",
  soundMode: WakeSoundMode,
): void {
  if (!GUIDED_TASK_EXPERIENCE_ENABLED) return;
  void import("../features/tasks/task-experience-feedback.js").then(({ signalTaskFeedback }) => {
    signalTaskFeedback(kind, soundMode);
  });
}

interface TaskResult {
  id: TaskId;
  category: TaskCategory;
  correct: number;
  total: number;
  timeMs: number;
  difficultyLevel?: number;
}

interface Session {
  id: string;
  date: string;
  wakeTime: string;
  startAlertness: number; // 1–10: 1 = barely awake, 10 = fully alert
  tasks: TaskResult[];
  endAlertness: number; // same scale
  followUp: FollowUp;
  totalMs: number;
}

function resumedServerSession(
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

function screenForSession(session: WakeSessionResponse, taskCount: number): Screen {
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
const TASK_META: Record<TaskId, { category: TaskCategory; title: string; subtitle: string }> = {
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
};

const CAT_META: Record<TaskCategory, { label: string; color: string; bg: string }> = {
  cognitive: { label: "Когнитивные", color: "text-accent", bg: "bg-accent/10" },
  movement: { label: "Движение", color: "text-green-400", bg: "bg-green-500/10" },
  behavioral: { label: "Поведение", color: "text-blue-400", bg: "bg-blue-500/10" },
  environment: { label: "Окружение", color: "text-yellow-400", bg: "bg-yellow-500/10" },
};

function CategoryIcon({
  category,
  className = "h-4 w-4",
}: {
  category: TaskCategory;
  className?: string;
}) {
  const taskId: Record<TaskCategory, TaskId> = {
    cognitive: "memory",
    movement: "steps",
    behavioral: "water",
    environment: "window",
  };
  return <TaskIcon taskId={taskId[category]} className={className} />;
}

function FollowUpIcon({
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

const MOCK_SESSIONS: Session[] = import.meta.env.DEV
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

// ─── Utilities ────────────────────────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const STROOP = [
  { label: "Красный", value: "red", cls: "text-red-400" },
  { label: "Синий", value: "blue", cls: "text-blue-400" },
  { label: "Зелёный", value: "green", cls: "text-green-400" },
  { label: "Жёлтый", value: "yell", cls: "text-yellow-300" },
];
function makeStroopQs() {
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

function getConfidence(n: number): Confidence {
  if (n < 2) return "insufficient";
  if (n < 3) return "low";
  if (n < 6) return "medium";
  return "high";
}

const CONF_LABEL: Record<Confidence, string> = {
  insufficient: "Недостаточно данных",
  low: "Низкая уверенность",
  medium: "Средняя уверенность",
  high: "Высокая уверенность",
};

function taskMeta(taskId: string) {
  return taskId in TASK_META ? TASK_META[taskId as TaskId] : null;
}

function taskCountLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} задание`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return `${count} задания`;
  }
  return `${count} заданий`;
}

function durationLabel(durationMs: number | null): string {
  if (durationMs === null) return "Время не зафиксировано";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} сек`;
  return seconds === 0 ? `${minutes} мин` : `${minutes} мин ${seconds} сек`;
}

function wakeContextLabel(context: WakeContext | "unspecified"): string {
  if (context === "night_sleep") return "После ночного сна";
  if (context === "short_nap") return "После короткого сна";
  if (context === "long_nap") return "После долгого дневного сна";
  if (context === "energy_reset") return "Перезагрузка без сна";
  return "Контекст не указан";
}

function followUpLabel(followUp: FollowUp): string {
  if (followUp === "up") return "Через 15 минут: встал";
  if (followUp === "back") return "Через 15 минут: лёг обратно";
  if (followUp === "drowsy") return "Через 15 минут: ещё сонный";
  return "Проверка через 15 минут не пройдена";
}

function computeCategoryEffectiveness(sessions: Session[]) {
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

function catEffLabel(avgDelta: number, sessions: number): { text: string; color: string } {
  const conf = getConfidence(sessions);
  if (conf === "insufficient")
    return { text: "Недостаточно данных", color: "text-muted-foreground" };
  if (avgDelta >= 5) return { text: "Помогает сильнее всего", color: "text-green-400" };
  if (avgDelta >= 3) return { text: "Хороший эффект", color: "text-green-400" };
  if (avgDelta >= 1) return { text: "Умеренный эффект", color: "text-yellow-400" };
  return { text: "Пока слабый эффект", color: "text-muted-foreground" };
}

function computeNextPlan(sessions: Session[]): {
  taskIds: TaskId[];
  rationale: string;
  isLearning: boolean;
} {
  const valid = sessions.filter((s) => s.endAlertness > 0);
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

function selectTasks(sessionCount: number, allSessions: Session[]): TaskId[] {
  if (sessionCount < LEARNING_SEQ.length) return LEARNING_SEQ[sessionCount];
  const plan = computeNextPlan(allSessions);
  return plan.taskIds;
}

// ─── Math Task ────────────────────────────────────────────────────────────────
export function MathTask({
  durationMinutes,
  onDone,
}: {
  durationMinutes: WakeDurationMinutes;
  onDone: (r: TaskResult) => void;
}) {
  const target = taskSuccessTarget("math", durationMinutes);
  const [level, setLevel] = useState<DifficultyLevel>(1);
  const [question, setQuestion] = useState(() => makeMathQuestion(1));
  const [sel, setSel] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const maxLevel = useRef<DifficultyLevel>(1);
  const t0 = useRef(Date.now());
  function pick(opt: number) {
    if (sel !== null) return;
    setSel(opt);
    const isCorrect = opt === question.answer;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextAttempts = attempts + 1;
    const nextCorrectStreak = isCorrect ? correctStreak + 1 : 0;
    const nextWrongStreak = isCorrect ? 0 : wrongStreak + 1;
    const nextLevel = adaptDifficulty(level, nextCorrectStreak, nextWrongStreak);
    setCorrect(nextCorrect);
    setAttempts(nextAttempts);
    setCorrectStreak(nextLevel !== level ? 0 : nextCorrectStreak);
    setWrongStreak(nextLevel !== level ? 0 : nextWrongStreak);
    setLevel(nextLevel);
    maxLevel.current = Math.max(maxLevel.current, nextLevel) as DifficultyLevel;
    setTimeout(() => {
      if (nextCorrect < target) {
        setQuestion(makeMathQuestion(nextLevel));
        setSel(null);
      } else {
        onDone({
          id: "math",
          category: "cognitive",
          correct: nextCorrect,
          total: nextAttempts,
          timeMs: Date.now() - t0.current,
          difficultyLevel: maxLevel.current,
        });
      }
    }, 600);
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-3">
          Правильных: {correct}/{target} · уровень {level}
        </p>
        <div className="text-5xl font-extrabold tracking-tight">{question.expr} = ?</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {question.options.map((opt) => {
          let cls = "py-5 rounded-2xl text-2xl font-bold text-center transition-all duration-200 ";
          if (!sel) cls += "bg-secondary text-foreground cursor-pointer active:scale-95";
          else if (opt === question.answer)
            cls += "bg-green-500/20 text-green-400 border-2 border-green-500/50";
          else if (opt === sel) cls += "bg-red-500/20 text-red-400 border-2 border-red-500/50";
          else cls += "bg-secondary/40 text-muted-foreground";
          return (
            <button key={opt} className={cls} onClick={() => pick(opt)}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Memory Task ──────────────────────────────────────────────────────────────
export function MemoryTask({
  durationMinutes,
  onDone,
}: {
  durationMinutes: WakeDurationMinutes;
  onDone: (r: TaskResult) => void;
}) {
  const target = taskSuccessTarget("memory", durationMinutes);
  const [level, setLevel] = useState<DifficultyLevel>(1);
  const [seq, setSeq] = useState(() => makeMemorySequence(1));
  const [phase, setPhase] = useState<"show" | "recall">("show");
  const [cd, setCd] = useState(4);
  const [entered, setEntered] = useState<number[]>([]);
  const [correctRounds, setCorrectRounds] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const maxLevel = useRef<DifficultyLevel>(1);
  const t0 = useRef(Date.now());
  useEffect(() => {
    if (phase !== "show") return;
    if (cd === 0) {
      setPhase("recall");
      return;
    }
    const t = setTimeout(() => setCd((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cd, phase]);
  function digit(d: number) {
    if (entered.length < seq.length) setEntered((e) => [...e, d]);
  }
  function submit() {
    const ok = entered.length === seq.length && entered.every((d, i) => d === seq[i]);
    const nextCorrect = correctRounds + (ok ? 1 : 0);
    const nextAttempts = attempts + 1;
    const nextLevel = ok
      ? (Math.min(3, level + 1) as DifficultyLevel)
      : (Math.max(1, level - 1) as DifficultyLevel);
    maxLevel.current = Math.max(maxLevel.current, nextLevel) as DifficultyLevel;
    setAttempts(nextAttempts);
    setCorrectRounds(nextCorrect);
    if (nextCorrect >= target) {
      onDone({
        id: "memory",
        category: "cognitive",
        correct: nextCorrect,
        total: nextAttempts,
        timeMs: Date.now() - t0.current,
        difficultyLevel: maxLevel.current,
      });
      return;
    }
    setLevel(nextLevel);
    setSeq(makeMemorySequence(nextLevel));
    setEntered([]);
    setCd(4);
    setPhase("show");
  }
  if (phase === "show")
    return (
      <div className="flex flex-col items-center gap-8">
        <p className="text-muted-foreground text-sm">
          Правильно {correctRounds}/{target} · запомни новую последовательность
        </p>
        <div className="flex w-full max-w-sm gap-2">
          {seq.map((n, i) => (
            <div
              key={i}
              data-memory-digit={n}
              className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-accent/30 bg-accent/20 text-2xl font-extrabold text-accent sm:h-14 sm:max-w-14 sm:rounded-2xl sm:text-3xl"
            >
              {n}
            </div>
          ))}
        </div>
        <div className="text-8xl font-black text-primary">{cd}</div>
        <p className="text-muted-foreground text-sm">сек</p>
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-muted-foreground text-sm text-center">
        Введи последовательность · правильно {correctRounds}/{target}
      </p>
      <div className="flex w-full max-w-sm gap-2">
        {Array.from({ length: seq.length }, (_, i) => (
          <div
            key={i}
            className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl text-2xl font-extrabold transition-all sm:h-14 sm:max-w-14 sm:rounded-2xl sm:text-3xl ${i < entered.length ? "border border-accent/30 bg-accent/20 text-accent" : "border border-border bg-secondary text-muted-foreground"}`}
          >
            {i < entered.length ? entered[i] : "·"}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            onClick={() => digit(d)}
            className="h-12 rounded-xl text-xl font-semibold bg-secondary text-foreground active:scale-95 transition-transform"
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => setEntered((e) => e.slice(0, -1))}
          className="h-12 rounded-xl text-xl bg-secondary text-muted-foreground active:scale-95 transition-transform"
        >
          ⌫
        </button>
        <button
          onClick={() => digit(0)}
          className="h-12 rounded-xl text-xl font-semibold bg-secondary text-foreground active:scale-95 transition-transform"
        >
          0
        </button>
        <button
          onClick={submit}
          disabled={entered.length < seq.length}
          aria-label="Проверить последовательность"
          className={`h-12 rounded-xl text-xl font-semibold transition-all ${entered.length === seq.length ? "bg-primary text-white active:scale-95" : "bg-secondary/40 text-muted-foreground"}`}
        >
          <Check className="mx-auto h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ─── Stroop Task ──────────────────────────────────────────────────────────────
export function StroopTask({
  durationMinutes,
  onDone,
}: {
  durationMinutes: WakeDurationMinutes;
  onDone: (r: TaskResult) => void;
}) {
  const target = taskSuccessTarget("stroop", durationMinutes);
  const [question, setQuestion] = useState(() => makeStroopQs()[0]!);
  const [sel, setSel] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const t0 = useRef(Date.now());
  function pick(val: string) {
    if (sel !== null) return;
    setSel(val);
    const nextCorrect = correct + (val === question.answer ? 1 : 0);
    const nextAttempts = attempts + 1;
    setCorrect(nextCorrect);
    setAttempts(nextAttempts);
    setTimeout(() => {
      if (nextCorrect < target) {
        setQuestion(makeStroopQs()[0]!);
        setSel(null);
      } else {
        onDone({
          id: "stroop",
          category: "cognitive",
          correct: nextCorrect,
          total: nextAttempts,
          timeMs: Date.now() - t0.current,
        });
      }
    }, 600);
  }
  const q = question;
  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-6">
          Правильных: {correct}/{target} · Какого цвета написано слово?
        </p>
        <div
          data-testid="stroop-word"
          className={`text-5xl font-black tracking-widest ${q.inkClass}`}
        >
          {q.word}
        </div>
        <p className="text-xs text-muted-foreground mt-3">не читай слово — смотри на ЦВЕТ букв</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {q.options.map((opt) => {
          let cls =
            "py-4 rounded-2xl font-semibold text-sm text-center transition-all duration-200 ";
          if (!sel) cls += "bg-secondary text-foreground cursor-pointer active:scale-95";
          else if (opt.value === q.answer)
            cls += "bg-green-500/20 text-green-400 border-2 border-green-500/50";
          else if (opt.value === sel)
            cls += "bg-red-500/20 text-red-400 border-2 border-red-500/50";
          else cls += "bg-secondary/40 text-muted-foreground";
          return (
            <button key={opt.value} className={cls} onClick={() => pick(opt.value)}>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Reaction Task ────────────────────────────────────────────────────────────
export function ReactionTask({
  durationMinutes,
  onDone,
  soundMode = "off",
}: {
  durationMinutes: WakeDurationMinutes;
  onDone: (r: TaskResult) => void;
  soundMode?: WakeSoundMode;
}) {
  const target = taskSuccessTarget("reaction", durationMinutes);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"wait" | "go" | "result">("wait");
  const [times, setTimes] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [lastWasFast, setLastWasFast] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const transitionTimer = useRef<ReturnType<typeof setTimeout>>();
  const tapLocked = useRef(true);
  const goAt = useRef(0);
  const t0 = useRef(Date.now());
  useEffect(() => {
    if (phase !== "wait") return;
    const delay = 1500 + Math.random() * 2500;
    timer.current = setTimeout(() => {
      goAt.current = Date.now();
      tapLocked.current = false;
      setPhase("go");
      sendTaskFeedback("cue", soundMode);
    }, delay);
    return () => clearTimeout(timer.current);
  }, [phase, round, soundMode]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(transitionTimer.current);
    },
    [],
  );
  function handleTap() {
    if (phase === "go" && !tapLocked.current) {
      tapLocked.current = true;
      const rt = Date.now() - goAt.current;
      const passed = rt < 500;
      setLastMs(rt);
      setLastWasFast(passed);
      const next = [...times, rt];
      setTimes(next);
      setPhase("result");
      if (!passed) {
        transitionTimer.current = setTimeout(() => setPhase("wait"), 800);
      } else if (round + 1 < target) {
        setRound((r) => r + 1);
        transitionTimer.current = setTimeout(() => setPhase("wait"), 800);
      } else {
        transitionTimer.current = setTimeout(
          () =>
            onDone({
              id: "reaction",
              category: "cognitive",
              correct: target,
              total: next.length,
              timeMs: Date.now() - t0.current,
            }),
          1200,
        );
      }
    }
  }
  const avgMs = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null;
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-1">
          Раунд {Math.min(round + 1, target)} из {target}
        </p>
        <p className="text-xs text-muted-foreground">
          {phase === "wait"
            ? "Кнопка включится после сигнала · цель быстрее 500 мс"
            : phase === "result"
              ? lastWasFast
                ? `Засчитано · среднее: ${avgMs} мс`
                : "Нужно быстрее 500 мс — попробуй ещё раз"
              : "Нажимай!"}
        </p>
      </div>
      <button
        onClick={handleTap}
        disabled={phase !== "go"}
        aria-label={phase === "go" ? "Нажать по сигналу" : "Ожидание сигнала"}
        className={`w-48 h-48 rounded-full text-3xl font-extrabold transition-all duration-150 border-4 ${
          phase === "go"
            ? "bg-green-500 border-green-400 text-white scale-105 shadow-[0_0_60px_rgba(34,197,94,0.5)]"
            : phase === "result"
              ? "bg-primary/20 border-primary/30 text-primary"
              : "bg-secondary border-border text-muted-foreground"
        }`}
      >
        {phase === "go" ? (
          "ЖМИ!"
        ) : phase === "result" ? (
          lastMs ? (
            `${lastMs}мс`
          ) : (
            <Zap className="mx-auto h-8 w-8" />
          )
        ) : (
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
        )}
      </button>
      {times.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4">
          {times.map((t, i) => (
            <div key={i} className="text-center">
              <div
                className={`text-lg font-bold ${t < 300 ? "text-green-400" : t < 500 ? "text-yellow-400" : "text-red-400"}`}
              >
                {t}мс
              </div>
              <div className="text-xs text-muted-foreground">П{i + 1}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tasks Container ──────────────────────────────────────────────────────────
export function TasksContainer({
  taskIds,
  taskIndex,
  durationMinutes,
  onDone,
  soundMode = "off",
  onSoundModeChange = () => undefined,
  onReplace,
  substitutionEnabled = false,
  submitting = false,
  guidedExperience = GUIDED_TASK_EXPERIENCE_ENABLED,
}: {
  taskIds: TaskId[];
  taskIndex: number;
  durationMinutes: WakeDurationMinutes;
  onDone: (r: TaskResult) => void;
  soundMode?: WakeSoundMode;
  onSoundModeChange?: (mode: WakeSoundMode) => void;
  onReplace?: (stepIndex: number, reason: TaskSubstitutionReason) => void;
  substitutionEnabled?: boolean;
  submitting?: boolean;
  guidedExperience?: boolean;
}) {
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [replacementTarget, setReplacementTarget] = useState<number | null>(null);
  const id = taskIds[taskIndex];
  const nextId = taskIds[taskIndex + 1];
  const meta = TASK_META[id];
  const catMeta = CAT_META[meta.category];
  const plannedSeconds = taskIds.map((taskId) => estimatedTaskSeconds(taskId, durationMinutes));
  const plannedTotal = plannedSeconds.reduce((total, seconds) => total + seconds, 0);
  const plannedCompleted = plannedSeconds
    .slice(0, taskIndex)
    .reduce((total, seconds) => total + seconds, 0);
  const plannedRemaining = plannedSeconds
    .slice(taskIndex)
    .reduce((total, seconds) => total + seconds, 0);
  const progress = plannedTotal === 0 ? 0 : (plannedCompleted / plannedTotal) * 100;
  const remainingLabel =
    plannedRemaining < 60
      ? `≈ ${plannedRemaining} сек осталось`
      : `≈ ${Math.ceil(plannedRemaining / 60)} мин осталось`;
  const completeTask = (result: TaskResult) => {
    if (submitting) return;
    onDone(result);
  };
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 pt-5"
      aria-busy={submitting}
    >
      <div className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Шаг {taskIndex + 1} из {taskIds.length} · {remainingLabel}
          </span>
          <div className="flex items-start gap-2">
            {substitutionEnabled && onReplace && id !== "sit_edge" && (
              <button
                type="button"
                onClick={() => setReplacementTarget(taskIndex)}
                disabled={submitting}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground disabled:opacity-50 active:scale-[0.98]"
              >
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
                Заменить
              </button>
            )}
            <button
              type="button"
              aria-expanded={protocolOpen}
              onClick={() => setProtocolOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground active:scale-[0.98]"
            >
              Протокол
              <ChevronRight className="h-4 w-4 text-primary" />
            </button>
          </div>
        </div>
        <div className="mb-2 flex items-center justify-end">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${catMeta.bg} border-transparent ${catMeta.color}`}
          >
            <span className="inline-flex items-center gap-1">
              <CategoryIcon category={meta.category} className="h-3.5 w-3.5" />
              {catMeta.label}
            </span>
          </span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {guidedExperience && (
          <div className="mt-3 flex justify-end">
            <Suspense fallback={<div className="h-10 w-24 rounded-xl bg-card" />}>
              <TaskSoundToggle compact mode={soundMode} onChange={onSoundModeChange} />
            </Suspense>
          </div>
        )}
        {protocolOpen && (
          <Suspense fallback={null}>
            <ProtocolSheet
              steps={taskIds.map((taskId) => ({ taskId, title: TASK_META[taskId].title }))}
              currentIndex={taskIndex}
              onClose={() => setProtocolOpen(false)}
            />
          </Suspense>
        )}
        {replacementTarget !== null && onReplace && (
          <Suspense fallback={null}>
            <TaskSubstitutionSheet
              taskTitle={TASK_META[taskIds[replacementTarget]!].title}
              busy={submitting}
              onClose={() => setReplacementTarget(null)}
              onSelect={(reason) => {
                onReplace(replacementTarget, reason);
                setReplacementTarget(null);
              }}
            />
          </Suspense>
        )}
      </div>
      <div className="mb-4 flex min-h-[64px] items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/20 flex items-center justify-center text-primary">
          <TaskIcon taskId={id} className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold">{meta.title}</h2>
          <p className="text-sm text-muted-foreground">
            {durationMinutes === 10 && id === "math"
              ? "5 правильных примеров"
              : durationMinutes === 10 && id === "memory"
                ? "3 правильные последовательности"
                : durationMinutes === 10 && (id === "stroop" || id === "reaction")
                  ? "5 успешных раундов"
                  : meta.subtitle}
          </p>
        </div>
      </div>
      <div className="mb-4 min-h-[54px]">
        {nextId && (
          <div className="flex min-h-[54px] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Дальше
            </span>
            <TaskIcon taskId={nextId} className="h-4 w-4 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {TASK_META[nextId].title}
            </span>
            {substitutionEnabled && onReplace && nextId !== "sit_edge" ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReplacementTarget(taskIndex + 1)}
                className="min-h-9 rounded-xl px-2 text-xs font-semibold text-primary disabled:opacity-50"
              >
                Заменить
              </button>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>
      <div
        className="flex min-h-[480px] flex-1 flex-col rounded-3xl border border-border/80 bg-card/35 p-4"
        data-testid="task-experience-shell"
      >
        {guidedExperience && (
          <div className="mb-4 h-28 shrink-0" data-testid="task-motion-region">
            <Suspense fallback={<div className="h-28 rounded-3xl bg-secondary/40" />}>
              <TaskMotionVisual taskId={id} />
            </Suspense>
          </div>
        )}
        <div className="min-h-[300px] flex-1" data-testid="task-interaction-region">
          {id === "math" && (
            <MathTask
              key={`${id}-${taskIndex}`}
              durationMinutes={durationMinutes}
              onDone={completeTask}
            />
          )}
          {id === "memory" && (
            <MemoryTask
              key={`${id}-${taskIndex}`}
              durationMinutes={durationMinutes}
              onDone={completeTask}
            />
          )}
          {id === "stroop" && (
            <StroopTask
              key={`${id}-${taskIndex}`}
              durationMinutes={durationMinutes}
              onDone={completeTask}
            />
          )}
          {id === "reaction" && (
            <ReactionTask
              key={`${id}-${taskIndex}`}
              durationMinutes={durationMinutes}
              soundMode={soundMode}
              onDone={completeTask}
            />
          )}
          {(id === "steps" ||
            id === "squats" ||
            id === "shake" ||
            id === "water" ||
            id === "window" ||
            id === "curtains" ||
            id === "sit_edge" ||
            id === "cool_wash" ||
            id === "pushups") && (
            <Suspense fallback={<div className="min-h-[300px] rounded-2xl bg-secondary/30" />}>
              <ConfirmTask
                key={`${id}-${taskIndex}`}
                taskId={id}
                durationMinutes={durationMinutes}
                soundMode={soundMode}
                onDone={completeTask}
              />
            </Suspense>
          )}
        </div>
        <div
          className="grid min-h-10 shrink-0 place-items-center pt-2 text-xs text-muted-foreground"
          aria-live="polite"
          data-testid="task-submit-region"
        >
          {submitting ? "Подтверждаем шаг на сервере…" : "Переход произойдёт после подтверждения"}
        </div>
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({
  onStart,
  sessions,
  demo,
  localStorageScope,
  onOpenSettings,
}: {
  onStart: () => void;
  sessions: Session[];
  demo: boolean;
  localStorageScope: string;
  onOpenSettings: () => void;
}) {
  const analytics = useAnalyticsProfile(!demo, sessions.length);
  const history = useSessionHistory(!demo, sessions.length);
  const valid = sessions.filter((s) => s.endAlertness > 0);
  const serverItems = history.status === "ready" ? history.items : [];
  const apiProfile = analytics.status === "ready" ? analytics.profile : null;
  const experimentCount = demo
    ? valid.length
    : (apiProfile?.averageDelta.evidenceCount ?? serverItems.length);
  const averageValue = demo
    ? valid.length
      ? valid.reduce((sum, item) => sum + item.endAlertness - item.startAlertness, 0) / valid.length
      : null
    : (apiProfile?.averageDelta.value ?? null);
  const avgGain = averageValue === null ? "—" : averageValue.toFixed(1);
  const isLearning = experimentCount < 7;
  const lp = Math.min(experimentCount, 7);

  return (
    <div className="flex flex-col flex-1 px-5 pt-14 pb-28 overflow-y-auto">
      <div className="mb-6">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <ProsnixBrand />
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5"
            aria-label={`Завершено сессий: ${experimentCount}`}
          >
            <Flame className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">{experimentCount}</span>
            <span className="hidden text-xs text-muted-foreground min-[350px]:inline">сессий</span>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Помогает прийти в себя после любого сна
        </p>
      </div>

      {/* Learning status */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          {isLearning ? (
            <Zap className="w-4 h-4 text-accent" />
          ) : (
            <Sparkles className="w-4 h-4 text-primary" />
          )}
          <p className={`text-sm font-semibold ${isLearning ? "text-accent" : "text-primary"}`}>
            {isLearning ? "Изучаем твоё пробуждение" : "Первый профиль пробуждения готов"}
          </p>
        </div>
        {isLearning && (
          <div className="flex gap-1.5 mb-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full ${i < lp ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {isLearning
            ? lp < 7
              ? `${lp} из 7 экспериментов · Пробуем разные комбинации, чтобы понять, что помогает именно тебе.`
              : "7 из 7 · Ещё один шаг до первых выводов!"
            : "Мы уже нашли первые закономерности и продолжим уточнять их после новых пробуждений."}
        </p>
      </div>

      {GOAL_CALIBRATION_ENABLED && (
        <Suspense fallback={null}>
          <MorningExperienceSlot
            mode="due"
            storageScope={localStorageScope}
            onOpenSettings={onOpenSettings}
          />
        </Suspense>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Средний прирост</p>
          <div className="flex items-end gap-1">
            <span className="text-3xl font-extrabold">
              {avgGain === "—" ? "—" : `${(averageValue ?? 0) >= 0 ? "+" : ""}${avgGain}`}
            </span>
            {experimentCount > 0 && (
              <span className="text-muted-foreground text-sm mb-0.5">балла</span>
            )}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Экспериментов</p>
          <div className="flex items-end gap-1">
            <span className="text-3xl font-extrabold">{experimentCount}</span>
            <span className="text-muted-foreground text-sm mb-0.5">/ {isLearning ? "7" : "∞"}</span>
          </div>
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full py-5 rounded-2xl text-lg font-bold text-white flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
        style={{
          background: "linear-gradient(135deg,#F97316,#EA580C)",
          boxShadow: "0 8px 32px rgba(249,115,22,.25)",
        }}
      >
        <Sun className="w-5 h-5" /> {demo ? "Попробовать пробуждение" : "Начать пробуждение"}
      </button>
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────
function ResultsScreen({
  session,
  allSessions,
  onStats,
  onHome,
  onSettings,
  onFollowUp,
  localStorageScope,
  routine,
  demo,
}: {
  session: Session;
  allSessions: Session[];
  onStats: () => void;
  onHome: () => void;
  onSettings: () => void;
  onFollowUp: (answer: Exclude<FollowUp, null>) => Promise<void>;
  localStorageScope: string;
  routine: WakeRoutine;
  demo: boolean;
}) {
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpAns, setFollowUpAns] = useState<FollowUp>(null);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const analytics = useAnalyticsProfile(!demo, allSessions.length);

  async function answerFollowUp(answer: Exclude<FollowUp, null>) {
    setFollowUpSaving(true);
    setFollowUpError(null);
    try {
      await onFollowUp(answer);
      setFollowUpAns(answer);
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : "Ответ пока не сохранён");
    } finally {
      setFollowUpSaving(false);
    }
  }

  const delta = session.endAlertness - session.startAlertness;
  const deltaColor =
    delta >= 4
      ? "text-green-400"
      : delta >= 2
        ? "text-yellow-400"
        : delta >= 0
          ? "text-orange-400"
          : "text-red-400";
  const validSessions = allSessions.filter((s) => s.endAlertness > 0);
  const evidenceCount = demo
    ? validSessions.length
    : analytics.status === "ready"
      ? analytics.profile.averageDelta.evidenceCount
      : null;
  const remaining = evidenceCount === null ? null : Math.max(0, 7 - evidenceCount);

  // Build insight
  let insightTitle = "Сессия сохранена";
  let insightBody = "";
  let insightColor = "border-border bg-secondary/30";
  let insightIcon: "saved" | "experiment" | "profile" = "saved";

  if (remaining === null) {
    insightBody =
      analytics.status === "error"
        ? "Сессия сохранена. Профиль обновится, когда аналитика снова будет доступна."
        : "Сессия сохранена. Обновляем профиль по всем завершённым пробуждениям…";
  } else if (remaining > 3) {
    insightBody = `Мы пока собираем данные. Ещё ${remaining} пробуждений помогут определить первые закономерности.`;
  } else if (remaining > 0) {
    insightTitle = "Почти готово";
    insightBody = `Ещё ${remaining} эксперимент${remaining === 1 ? "" : "а"} до первых персональных выводов.`;
    insightColor = "border-accent/20 bg-accent/8";
    insightIcon = "experiment";
  } else {
    insightTitle = "Профиль обновлён";
    insightBody = `Учтено ${evidenceCount} завершённых сессий. Рекомендации и лучший порядок заданий пересчитаны.`;
    insightColor = "border-primary/20 bg-primary/8";
    insightIcon = "profile";
  }

  return (
    <div className="flex flex-col flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="text-center pt-8 mb-8">
        <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
          <Check className="w-8 h-8 text-green-400" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold mb-1">Протокол завершён</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {GUIDED_TASK_EXPERIENCE_ENABLED && (
        <Suspense fallback={null}>
          <div className="mb-5">
            <PixGuide variant="reward" />
          </div>
        </Suspense>
      )}

      {/* Before / After / Effect — main result */}
      <div className="bg-card border border-border rounded-3xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-2">До</p>
            <p className="text-4xl font-black text-muted-foreground">
              {session.startAlertness}
              <span className="text-lg font-semibold">/10</span>
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-2">После</p>
            <p className="text-4xl font-black text-foreground">
              {session.endAlertness}
              <span className="text-lg font-semibold">/10</span>
            </p>
          </div>
          <div className="w-px h-12 bg-border mx-2" />
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-2">Эффект</p>
            <p className={`text-4xl font-black ${deltaColor}`}>
              {delta >= 0 ? "+" : ""}
              {delta}
            </p>
          </div>
        </div>
      </div>

      {/* Today's protocol */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <p className="text-sm font-semibold mb-3">Сегодняшний протокол</p>
        <div className="flex items-center gap-2 flex-wrap">
          {session.tasks.map((t, i) => {
            const meta = TASK_META[t.id];
            const catMeta = CAT_META[t.category];
            return (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${catMeta.bg} border-transparent`}
                >
                  <TaskIcon taskId={t.id} className={`h-4 w-4 ${catMeta.color}`} />
                  <span className={`text-xs font-semibold ${catMeta.color}`}>{meta.title}</span>
                </div>
                {i < session.tasks.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight */}
      <div className={`border rounded-2xl p-4 mb-4 ${insightColor}`}>
        <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {insightIcon === "profile" ? (
            <BarChart2 className="h-3.5 w-3.5" />
          ) : insightIcon === "experiment" ? (
            <Sparkles className="h-3.5 w-3.5" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {insightTitle}
        </p>
        <p className="text-sm text-foreground leading-relaxed">{insightBody}</p>
      </div>

      {/* Follow-up */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        {!followUpAns ? (
          <>
            <p className="text-sm font-semibold mb-1">Через 15 минут мы проверим</p>
            <p className="text-xs text-muted-foreground mb-3">
              Удалось ли тебе окончательно проснуться — это ключевая метрика.
            </p>
            {!showFollowUp ? (
              <button
                onClick={() => setShowFollowUp(true)}
                className="text-sm text-accent underline underline-offset-2"
              >
                Ответить сейчас
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {[
                  { val: "up" as FollowUp, label: "Да, уже встал" },
                  { val: "back" as FollowUp, label: "Снова лёг" },
                  {
                    val: "drowsy" as FollowUp,
                    label: "Не лёг, но всё ещё очень сонный",
                  },
                ].map((opt) => (
                  <button
                    key={String(opt.val)}
                    onClick={() => opt.val && void answerFollowUp(opt.val)}
                    disabled={followUpSaving}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3 text-left text-sm text-foreground transition-transform active:scale-[0.99]"
                  >
                    <FollowUpIcon answer={opt.val!} className="h-5 w-5 text-accent" />
                    {opt.label}
                  </button>
                ))}
                {followUpSaving && (
                  <p className="text-xs text-muted-foreground">Сохраняем ответ…</p>
                )}
                {followUpError && <p className="text-xs text-red-400">{followUpError}</p>}
              </div>
            )}
          </>
        ) : (
          <div className={`${followUpAns === "up" ? "text-green-400" : "text-red-400"}`}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FollowUpIcon answer={followUpAns} className="h-5 w-5" />
              {followUpAns === "up"
                ? "Встал и не лёг обратно"
                : followUpAns === "back"
                  ? "Вернулся в кровать"
                  : "Сонный, но не лёг"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ответ сохранён и учтён в профиле пробуждения
            </p>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <HomeScreenPrompt firstCompletion={evidenceCount === 1} />
      </Suspense>

      {GOAL_CALIBRATION_ENABLED &&
        evidenceCount !== null &&
        evidenceCount >= 1 &&
        evidenceCount <= 3 && (
          <Suspense fallback={null}>
            <MorningExperienceSlot
              mode="scheduled"
              storageScope={localStorageScope}
              sessionNumber={evidenceCount}
              onOpenSettings={onSettings}
            />
          </Suspense>
        )}

      <Suspense fallback={null}>
        <WakeRoutineChecklist sessionId={session.id} routine={routine} demo={demo} />
      </Suspense>

      <div className="flex gap-3">
        <button
          onClick={onHome}
          className="flex-1 py-4 bg-secondary rounded-2xl font-semibold active:scale-[0.98] transition-transform"
        >
          На главную
        </button>
        <button
          onClick={onStats}
          className="flex-1 py-4 rounded-2xl font-semibold text-white active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}
        >
          Статистика
        </button>
      </div>
    </div>
  );
}

// ─── Stats Screen ─────────────────────────────────────────────────────────────
function StatsScreen({
  sessions,
  demo,
  routine,
}: {
  sessions: Session[];
  demo: boolean;
  routine: WakeRoutine;
}) {
  const analytics = useAnalyticsProfile(!demo, sessions.length);
  const { state: coach, requestInsight, resetInsight } = useCoachInsight(!demo);
  const history = useSessionHistory(!demo, sessions.length);
  const [openHistoryIds, setOpenHistoryIds] = useState<Set<string>>(() => new Set());
  const [showAllHistory, setShowAllHistory] = useState(false);
  const apiProfile = analytics.status === "ready" ? analytics.profile : null;
  const valid = sessions.filter((s) => s.endAlertness > 0);
  const evidenceCount = demo ? valid.length : (apiProfile?.averageDelta.evidenceCount ?? 0);
  const isLearning = evidenceCount < 7;

  // Key metrics
  const avgGain = demo
    ? valid.length
      ? valid.reduce((s, v) => s + (v.endAlertness - v.startAlertness), 0) / valid.length
      : 0
    : (apiProfile?.averageDelta.value ?? 0);
  const followedUp = valid.filter((s) => s.followUp !== null);
  const successRate = demo
    ? followedUp.length
      ? Math.round((followedUp.filter((s) => s.followUp === "up").length / followedUp.length) * 100)
      : null
    : apiProfile?.riseSuccess.value === null || apiProfile?.riseSuccess.value === undefined
      ? null
      : Math.round(apiProfile.riseSuccess.value * 100);
  const serverDurations =
    history.status === "ready"
      ? history.items
          .map((item) => item.durationMs)
          .filter((duration): duration is number => duration !== null)
      : [];
  const avgMinutes = demo
    ? valid.length
      ? Math.round(
          (valid.reduce((sum, item) => sum + item.totalMs, 0) / valid.length / 60000) * 10,
        ) / 10
      : null
    : serverDurations.length
      ? Math.round(
          (serverDurations.reduce((sum, duration) => sum + duration, 0) /
            serverDurations.length /
            60000) *
            10,
        ) / 10
      : null;

  // Category profile
  const eff = computeCategoryEffectiveness(demo ? valid : []);
  const sortedCats = (Object.entries(eff) as [TaskCategory, (typeof eff)[TaskCategory]][])
    .filter(([, d]) => d.sessions > 0)
    .sort((a, b) => b[1].avgDelta - a[1].avgDelta);

  // Best sequence
  const sequenceCandidates =
    apiProfile?.sequenceEffects.filter((metric) => metric.value !== null) ?? [];
  const verifiedSequenceCandidates = sequenceCandidates.filter(
    ({ evidenceCount: count }) => count >= 2,
  );
  const bestSequence = (
    verifiedSequenceCandidates.length ? verifiedSequenceCandidates : sequenceCandidates
  ).sort(
    (left, right) =>
      (right.value ?? 0) - (left.value ?? 0) || right.evidenceCount - left.evidenceCount,
  )[0];
  const bestSequenceTasks = bestSequence
    ? bestSequence.key
        .replace(/^sequence:/, "")
        .split(">")
        .filter((taskId): taskId is TaskId => taskId in TASK_META)
    : [];

  // Next plan
  const nextPlan = computeNextPlan(sessions);
  const nextTaskMeta = nextPlan.taskIds.map((id) => ({ id, ...TASK_META[id] }));
  const coachExperiment =
    coach.status === "ready" && coach.insight.insight ? coach.insight.insight.nextExperiment : null;
  const nextExperimentTasks = demo
    ? nextTaskMeta.map(({ id }) => id)
    : isLearning
      ? []
      : bestSequenceTasks;
  const nextExperimentText = demo
    ? nextPlan.rationale
    : isLearning
      ? `Следующая сессия проверит новый допустимый порядок заданий в том же контексте и режиме. До первого профиля осталось ${7 - evidenceCount}; повтор перспективного порядка начнётся после калибровки.`
      : coachExperiment
        ? coachExperiment
        : bestSequence
          ? `Ближайшая полезная проверка — повторить порядок «${bestSequenceTasks.map((taskId) => TASK_META[taskId].title).join(" → ")}» после похожего сна и с тем же запасом времени. Ответ через 15 минут покажет, повторяется ли результат.`
          : "Пройди следующий назначенный протокол после похожего сна и обязательно ответь через 15 минут. Так появится первое честное сравнение последовательностей.";

  return (
    <div className="flex flex-col flex-1 px-5 pt-14 pb-28 overflow-y-auto">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-2xl font-bold">Статистика</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Что приложение узнало о твоём пробуждении?
      </p>

      {/* Learning progress */}
      {isLearning && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold text-accent">Период изучения</p>
          </div>
          <div className="flex gap-1.5 mb-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full ${i < evidenceCount ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {evidenceCount}/7 —{" "}
            {evidenceCount < 7
              ? `ещё ${7 - evidenceCount} до первого профиля`
              : "профиль формируется"}
          </p>
        </div>
      )}

      <section className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Следующий эксперимент</h2>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
            Один следующий шаг
          </span>
        </div>
        {nextExperimentTasks.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {nextExperimentTasks.map((taskId, index, all) => (
              <div key={`${taskId}-${index}`} className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-xs font-medium">
                  <TaskIcon taskId={taskId} className="h-3.5 w-3.5 text-primary" />
                  {TASK_META[taskId].title}
                </span>
                {index < all.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        )}
        <p className="text-sm leading-relaxed">{nextExperimentText}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Это рабочая проверка, а не доказанный лучший способ. Сравнение станет полезнее после
          повторов в похожих условиях.
        </p>
      </section>

      {!demo && (
        <section className="mb-5 rounded-2xl border border-accent/25 bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">Персональный отчёт</p>
          </div>
          {coach.status === "ready" && coach.insight.status === "confirmation_required" ? (
            <div className="rounded-xl border border-accent/20 bg-secondary/60 p-3">
              <p className="text-sm font-semibold">Пока мало данных для устойчивого вывода</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Сохранено {evidenceCount} из 3 рекомендуемых пробуждений. Можно подождать следующую
                сессию или потратить сегодняшний отчёт сейчас — он будет предварительным.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={resetInsight}
                  className="min-h-11 flex-1 rounded-xl bg-secondary px-3 text-sm font-semibold"
                >
                  Подождать
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void requestInsight(true);
                  }}
                  className="min-h-11 flex-1 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
                >
                  Создать всё равно
                </button>
              </div>
            </div>
          ) : coach.status === "idle" ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Отчёт объяснит устойчивость результата и изменения между пробуждениями. Доступен
                один новый бесплатный отчёт в день.
              </p>
              <button
                type="button"
                onClick={() => void requestInsight()}
                className="mt-3 min-h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground"
              >
                Создать персональный отчёт
              </button>
            </>
          ) : coach.status === "loading" ? (
            <p className="text-sm text-muted-foreground">Ищем закономерности в твоих данных…</p>
          ) : coach.status === "error" ? (
            <p className="text-sm text-muted-foreground">{coach.message}</p>
          ) : coach.status === "ready" ? (
            coach.insight.insight ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                  Главный вывод
                </p>
                <p className="mt-1 text-sm leading-relaxed">{coach.insight.insight.summary}</p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {coach.insight.insight.caveat}
                </p>
                {coach.insight.limitReached && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Следующее обновление доступно после{" "}
                    {new Date(coach.insight.refreshAvailableAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Отчёт пока недоступен.</p>
            )
          ) : null}
        </section>
      )}

      {/* Three key metrics */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-2" />
          <div className="text-xl font-extrabold">
            {evidenceCount ? `${avgGain >= 0 ? "+" : ""}${avgGain.toFixed(1)}` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Прирост</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
          <Check className="w-4 h-4 text-green-400 mx-auto mb-2" />
          <div className="text-xl font-extrabold">
            {successRate !== null ? `${successRate}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Подъём</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
          <Activity className="w-4 h-4 text-accent mx-auto mb-2" />
          <div className="text-xl font-extrabold">
            {avgMinutes !== null ? `${avgMinutes}м` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Время</div>
        </div>
      </div>

      {/* Wake-up profile */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-sm font-semibold mb-4">Твой профиль пробуждения</p>
        {!demo && analytics.status === "loading" ? (
          <p className="text-sm text-muted-foreground">
            Пересчитываем профиль по сохранённым сессиям…
          </p>
        ) : !demo && analytics.status === "error" ? (
          <p className="text-sm text-red-400">{analytics.message}</p>
        ) : !demo && apiProfile && (evidenceCount >= 7 || apiProfile.factorEffects.length > 0) ? (
          <Suspense fallback={<p className="text-sm text-muted-foreground">Готовим профиль…</p>}>
            <WakeProfileSummary
              profile={apiProfile}
              evidenceCount={evidenceCount}
              recentSessions={history.status === "ready" ? history.items : []}
            />
          </Suspense>
        ) : sortedCats.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {evidenceCount >= 7
              ? `Профиль готов по ${evidenceCount} завершённым сессиям. Сравнение отдельных факторов появится после трёх пар наблюдений.`
              : `Сохранено ${evidenceCount} завершённых сессий. Первый общий профиль появится после 7.`}
          </p>
        ) : (
          sortedCats.map(([cat, data]) => {
            const catMeta = CAT_META[cat];
            const conf = getConfidence(data.sessions);
            const eff2 = catEffLabel(data.avgDelta, data.sessions);
            const showNum = conf !== "insufficient" && conf !== "low";
            return (
              <div
                key={cat}
                className="flex items-start justify-between py-3 border-b border-border last:border-0"
              >
                <div className="flex items-start gap-3 flex-1">
                  <CategoryIcon category={cat} className={`mt-0.5 h-5 w-5 ${catMeta.color}`} />
                  <div>
                    <p className="text-sm font-semibold">{catMeta.label}</p>
                    <p className={`text-sm ${eff2.color}`}>{eff2.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CONF_LABEL[conf]} · {data.sessions}{" "}
                      {data.sessions === 1
                        ? "эксперимент"
                        : data.sessions < 5
                          ? "эксперимента"
                          : "экспериментов"}
                    </p>
                  </div>
                </div>
                {showNum && (
                  <div className="text-right">
                    <span
                      className={`text-lg font-black ${data.avgDelta >= 3 ? "text-green-400" : "text-yellow-400"}`}
                    >
                      +{data.avgDelta.toFixed(1)}
                    </span>
                    <p className="text-xs text-muted-foreground">к бодрости</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {!demo && (
        <Suspense fallback={null}>
          <StatsResearchCards refreshKey={sessions.length} />
        </Suspense>
      )}

      {/* History */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-semibold mb-3">История пробуждений</p>
        {demo &&
          [...valid]
            .reverse()
            .slice(0, 6)
            .map((s, i) => {
              const delta = s.endAlertness - s.startAlertness;
              const deltaColor2 =
                delta >= 4 ? "text-green-400" : delta >= 2 ? "text-yellow-300" : "text-red-400";
              return (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {s.date} · {s.wakeTime}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {s.tasks.map((t) => (
                        <span key={t.id} className="text-base">
                          <TaskIcon taskId={t.id} className="h-4 w-4 text-primary" />
                        </span>
                      ))}
                      {s.followUp === "back" && (
                        <span className="text-xs text-red-400 ml-1">лёг обратно</span>
                      )}
                      {s.followUp === "up" && (
                        <span className="text-xs text-green-400 ml-1">встал</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-lg font-black ${deltaColor2}`}>
                      {delta >= 0 ? "+" : ""}
                      {delta}
                      <span className="text-xs text-muted-foreground font-normal"> балла</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
        {!demo && history.status === "loading" && (
          <p className="text-sm text-muted-foreground">Загружаем сохранённые сессии…</p>
        )}
        {!demo && history.status === "error" && (
          <p className="text-sm text-red-400">{history.message}</p>
        )}
        {!demo &&
          history.status === "ready" &&
          (showAllHistory ? history.items : history.items.slice(0, 5)).map((item, index) => {
            const delta = item.postRating - item.baseline;
            const deltaColor =
              delta >= 4 ? "text-green-400" : delta >= 2 ? "text-yellow-300" : "text-red-400";
            return (
              <details
                key={item.id}
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  setOpenHistoryIds((current) => {
                    const next = new Set(current);
                    if (open) next.add(item.id);
                    else next.delete(item.id);
                    return next;
                  });
                }}
                className="group border-b border-border last:border-0"
              >
                <summary
                  aria-label={`Открыть эксперимент ${index + 1}`}
                  className="flex cursor-pointer list-none items-center justify-between py-3 [&::-webkit-details-marker]:hidden"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(item.completedAt).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.baseline} → {item.postRating} · {taskCountLabel(item.tasks.length)}
                      {item.followUp === "up"
                        ? " · встал"
                        : item.followUp === "back"
                          ? " · лёг обратно"
                          : item.followUp === "drowsy"
                            ? " · ещё сонный"
                            : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-lg font-black ${deltaColor}`}>
                      {delta >= 0 ? "+" : ""}
                      {delta}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </div>
                </summary>
                <div className="mb-3 rounded-xl bg-secondary/60 p-3">
                  <p className="text-xs font-semibold">Что было в эксперименте</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {item.tasks.map((task, taskIndex) => {
                      const meta = taskMeta(task.taskId);
                      return (
                        <div
                          key={`${task.taskId}-${taskIndex}`}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-card">
                            {meta ? (
                              <TaskIcon taskId={task.taskId as TaskId} className="h-3.5 w-3.5" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <span>
                            {taskIndex + 1}. {meta?.title ?? "Задание"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <p>
                      Бодрость: {item.baseline} → {item.postRating}
                    </p>
                    <p>Длительность: {durationLabel(item.durationMs)}</p>
                    <p>Контекст: {wakeContextLabel(item.wakeContext)}</p>
                    <p>Выбранный режим: {item.durationMinutes} мин</p>
                    <p className="col-span-2">{followUpLabel(item.followUp)}</p>
                  </div>
                  {openHistoryIds.has(item.id) && (
                    <div className="mt-3">
                      <Suspense fallback={null}>
                        <WakeRoutineChecklist sessionId={item.id} routine={routine} demo={false} />
                      </Suspense>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        {!demo && history.status === "ready" && history.items.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAllHistory((current) => !current)}
            className="mt-3 min-h-11 w-full rounded-xl bg-secondary px-3 text-sm font-semibold"
          >
            {showAllHistory ? "Скрыть ранние сессии" : `Показать ещё ${history.items.length - 5}`}
          </button>
        )}
        {((demo && valid.length === 0) ||
          (!demo && history.status === "ready" && history.items.length === 0)) && (
          <p className="text-sm text-muted-foreground">Ещё нет завершённых сессий.</p>
        )}
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({
  current,
  onTab,
}: {
  current: "home" | "stats" | "settings";
  onTab: (t: "home" | "stats" | "settings") => void;
}) {
  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-50 flex justify-around items-center px-8 py-3"
      style={{
        background: "rgba(23,17,9,0.92)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {[
        { key: "home" as const, icon: <Home className="w-5 h-5" />, label: "Главная" },
        { key: "stats" as const, icon: <BarChart2 className="w-5 h-5" />, label: "Статистика" },
        { key: "settings" as const, icon: <Settings className="w-5 h-5" />, label: "Настройки" },
      ].map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTab(tab.key)}
          className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-colors ${current === tab.key ? "text-primary" : "text-muted-foreground"}`}
        >
          {tab.icon}
          <span className="text-xs font-medium">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function PrototypeApp({
  demo,
  localStorageScope,
  resume,
  dueFollowUpSessionId,
  initialWakeSchedule,
  initialWakeProfile,
  initialWakeRoutine,
}: {
  demo: boolean;
  localStorageScope: string;
  resume?: NonNullable<BootstrapResponse["activeSession"]>;
  dueFollowUpSessionId?: string | null;
  initialWakeSchedule?: WakeSchedule | null;
  initialWakeProfile: WakeProfile;
  initialWakeRoutine: WakeRoutine;
}) {
  const launchSource = new URLSearchParams(window.location.search).get("source");
  const resumedTaskIds = (resume?.protocol.effectiveSteps ?? resume?.protocol.steps ?? [])
    .map(({ taskId }) => taskId)
    .filter((taskId): taskId is TaskId => taskId in TASK_META);
  const [screen, setScreen] = useState<Screen>(() =>
    initialProtocolScreen(resume, launchSource, initialWakeProfile.onboardingCompleted),
  );
  const [navTab, setNavTab] = useState<"home" | "stats" | "settings">("home");
  const [alarmTime, setAlarmTime] = useState(initialWakeSchedule?.localTime ?? "07:00");
  const [wakeSchedule, setWakeSchedule] = useState<WakeSchedule | null>(
    initialWakeSchedule ?? null,
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(demo ? MOCK_SESSIONS : []);
  const [serverSession, setServerSession] = useState<WakeSessionResponse | null>(
    resume ? resumedServerSession(resume) : null,
  );
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dueFollowUp, setDueFollowUp] = useState(dueFollowUpSessionId ?? null);
  const [wakeProfile, setWakeProfile] = useState(initialWakeProfile);
  const [wakeRoutine, setWakeRoutine] = useState(initialWakeRoutine);
  const [personalizationSaving, setPersonalizationSaving] = useState(false);

  const [taskIds, setTaskIds] = useState<TaskId[]>(resumedTaskIds);
  const [taskIndex, setTaskIndex] = useState(resume?.session.currentStepIndex ?? 0);
  const [activeDurationMinutes, setActiveDurationMinutes] = useState<WakeDurationMinutes>(
    resume?.session.durationMinutes ?? initialWakeProfile.defaultDurationMinutes,
  );
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [startAlertness, setStartAlertness] = useState(resume?.baseline ?? 0);
  const [soundMode, setSoundMode] = useState<WakeSoundMode>(
    resume?.session.experience?.soundMode === "on" ? "on" : "off",
  );
  const sessionStartRef = useRef(Date.now());
  const taskSubmissionGateRef = useRef(new TaskSubmissionGate());
  const [taskRenderVersion, setTaskRenderVersion] = useState(0);
  const [completedSession, setCompletedSession] = useState<Session | null>(null);
  const [pendingProfileExclusion, setPendingProfileExclusion] = useState<TaskId | null>(null);
  const directWakeStartedRef = useRef(false);

  useEffect(() => {
    taskSubmissionGateRef.current.reset();
  }, [serverSession?.id, taskIndex]);

  useEffect(() => {
    if (
      launchSource !== "wake" ||
      resume ||
      !wakeProfile.onboardingCompleted ||
      directWakeStartedRef.current
    ) {
      return;
    }
    directWakeStartedRef.current = true;
    void startSession("night_sleep", wakeProfile.defaultDurationMinutes);
  }, [launchSource, resume, wakeProfile.defaultDurationMinutes, wakeProfile.onboardingCompleted]);

  async function saveScheduleSetting(input: {
    localTime: string;
    timezone: string;
    enabled: boolean;
  }): Promise<void> {
    setScheduleSaving(true);
    setSyncError(null);
    try {
      const saved = demo
        ? {
            ...input,
            nextTriggerAt: input.enabled
              ? new Date(Date.now() + 24 * 60 * 60_000).toISOString()
              : null,
            botStatus: "unknown" as const,
            revision: (wakeSchedule?.revision ?? 0) + 1,
          }
        : await saveWakeSchedule(input);
      setWakeSchedule(saved);
      setAlarmTime(saved.localTime);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось сохранить напоминание");
      throw error;
    } finally {
      setScheduleSaving(false);
    }
  }

  function applyConflict(error: unknown, submittedStepIndex?: number): void {
    if (error instanceof SessionConflictError && error.canonicalSession) {
      const canonical = error.canonicalSession;
      const canonicalTaskIds = (canonical.effectiveSteps ?? canonical.assignment.steps)
        .map(({ taskId }) => taskId)
        .filter((taskId): taskId is TaskId => taskId in TASK_META);
      setServerSession(canonical);
      setTaskIndex(canonical.currentStepIndex);
      setTaskIds(canonicalTaskIds);
      setStartAlertness(canonical.baseline ?? 0);
      setScreen(screenForSession(canonical, canonicalTaskIds.length));
      setSyncError(
        taskSubmissionConflictMessage(
          error.code,
          submittedStepIndex,
          error.canonicalSession.currentStepIndex,
        ),
      );
      return;
    }
    setSyncError(error instanceof Error ? error.message : "Действие пока не подтверждено сервером");
  }

  async function startSession(wakeContext: WakeContext, durationMinutes: WakeDurationMinutes) {
    setSyncError(null);
    setSoundMode("off");
    setActiveDurationMinutes(durationMinutes);
    sessionStartRef.current = Date.now();
    if (demo) {
      const ids = selectTasks(sessions.length, sessions);
      setTaskIds(ids);
      setTaskIndex(0);
      setTaskResults([]);
      setStartAlertness(0);
      setScreen("startRating");
      return;
    }
    setSyncing(true);
    try {
      const created = await createWakeSession(
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        wakeContext,
        durationMinutes,
      );
      setServerSession(created);
      setTaskIds(
        (created.effectiveSteps ?? created.assignment.steps)
          .map(({ taskId }) => taskId)
          .filter((taskId): taskId is TaskId => taskId in TASK_META),
      );
      setTaskIndex(created.currentStepIndex);
      setTaskResults([]);
      setStartAlertness(0);
      setScreen("startRating");
    } catch (error) {
      applyConflict(error);
    } finally {
      setSyncing(false);
    }
  }

  async function handleStartRating(v: number) {
    setSyncError(null);
    if (demo) {
      setStartAlertness(v);
      setScreen("tasks");
      return;
    }
    if (!serverSession) return;
    setSyncing(true);
    try {
      const updated = await saveBaseline(serverSession.id, serverSession.version, v, soundMode);
      setServerSession(updated);
      setStartAlertness(v);
      setScreen("tasks");
    } catch (error) {
      applyConflict(error);
    } finally {
      setSyncing(false);
    }
  }

  async function handleTaskDone(result: TaskResult) {
    if (!taskSubmissionGateRef.current.acquire(taskIds[taskIndex], result.id)) return;
    setSyncError(null);
    if (demo) {
      const next = [...taskResults, result];
      setTaskResults(next);
      sendTaskFeedback("success", soundMode);
      if (taskIndex + 1 < taskIds.length) setTaskIndex((i) => i + 1);
      else setScreen("endRating");
      return;
    }
    if (!serverSession) return;
    setSyncing(true);
    try {
      const updated = await saveTaskResult(serverSession.id, serverSession.version, taskIndex, {
        taskId: result.id,
        correct: result.correct,
        total: result.total,
        durationMs: result.timeMs,
        ...(result.difficultyLevel === undefined
          ? {}
          : { difficultyLevel: result.difficultyLevel }),
      });
      setServerSession(updated);
      const updatedTaskIds = (updated.effectiveSteps ?? updated.assignment.steps)
        .map(({ taskId }) => taskId)
        .filter((taskId): taskId is TaskId => taskId in TASK_META);
      setTaskIds(updatedTaskIds);
      setTaskResults((current) => [...current, result]);
      setTaskIndex(updated.currentStepIndex);
      sendTaskFeedback("success", soundMode);
      if (updated.currentStepIndex >= updatedTaskIds.length) setScreen("endRating");
    } catch (error) {
      taskSubmissionGateRef.current.reset();
      setTaskRenderVersion((version) => version + 1);
      sendTaskFeedback("error", soundMode);
      applyConflict(error, taskIndex);
    } finally {
      setSyncing(false);
    }
  }

  async function handleTaskReplacement(
    stepIndex: number,
    reason: TaskSubstitutionReason,
  ): Promise<void> {
    const originalTaskId = taskIds[stepIndex];
    if (!originalTaskId) return;
    setSyncError(null);
    if (demo) {
      const replacement = (["reaction", "stroop", "memory", "math", "shake"] as TaskId[]).find(
        (taskId) => taskId !== originalTaskId && !taskIds.includes(taskId),
      );
      if (!replacement) {
        setSyncError("Для этого шага сейчас нет новой безопасной альтернативы.");
        return;
      }
      setTaskIds((current) =>
        current.map((taskId, index) => (index === stepIndex ? replacement : taskId)),
      );
      if (reason === "cannot_do") setPendingProfileExclusion(originalTaskId);
      return;
    }
    if (!serverSession) return;
    setSyncing(true);
    try {
      const updated = await substituteWakeTask(
        serverSession.id,
        serverSession.version,
        stepIndex,
        reason,
      );
      const updatedTaskIds = (updated.effectiveSteps ?? updated.assignment.steps)
        .map(({ taskId }) => taskId)
        .filter((taskId): taskId is TaskId => taskId in TASK_META);
      setServerSession(updated);
      setTaskIds(updatedTaskIds);
      if (reason === "cannot_do") setPendingProfileExclusion(originalTaskId);
    } catch (error) {
      if (error instanceof SessionConflictError && error.code === "no_alternative") {
        if (error.canonicalSession) {
          setServerSession(error.canonicalSession);
          setTaskIds(
            (error.canonicalSession.effectiveSteps ?? error.canonicalSession.assignment.steps)
              .map(({ taskId }) => taskId)
              .filter((taskId): taskId is TaskId => taskId in TASK_META),
          );
        }
        setSyncError("Для этого шага сейчас нет новой безопасной альтернативы.");
      } else {
        applyConflict(error);
      }
    } finally {
      setSyncing(false);
    }
  }

  async function confirmProfileExclusion(): Promise<void> {
    if (!pendingProfileExclusion) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await updateWakeProfile({
        movementLevel: wakeProfile.movementLevel,
        availableResources: wakeProfile.availableResources,
        excludedTaskIds: [...new Set([...wakeProfile.excludedTaskIds, pendingProfileExclusion])],
        defaultDurationMinutes: wakeProfile.defaultDurationMinutes,
        onboardingCompleted: wakeProfile.onboardingCompleted,
      });
      setPendingProfileExclusion(null);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось обновить ограничения");
    } finally {
      setSyncing(false);
    }
  }

  async function handleEndRating(endAlertness: number) {
    setSyncError(null);
    let confirmedTasks = taskResults;
    if (!demo) {
      if (!serverSession) return;
      setSyncing(true);
      try {
        const updated = await savePostRating(serverSession.id, serverSession.version, endAlertness);
        setServerSession(updated);
        confirmedTasks = updated.tasks
          .filter(({ taskId }) => taskId in TASK_META)
          .map((task) => ({
            id: task.taskId as TaskId,
            category: task.category,
            correct: task.correct,
            total: task.total,
            timeMs: task.durationMs,
            ...(task.difficultyLevel === undefined
              ? {}
              : { difficultyLevel: task.difficultyLevel }),
          }));
      } catch (error) {
        applyConflict(error);
        setSyncing(false);
        return;
      }
      setSyncing(false);
    }
    const session: Session = {
      id: serverSession?.id ?? `s${Date.now()}`,
      date: new Date().toLocaleDateString("ru", { day: "numeric", month: "short" }),
      wakeTime: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      startAlertness,
      tasks: confirmedTasks,
      endAlertness,
      followUp: null,
      totalMs: Date.now() - sessionStartRef.current,
    };
    setCompletedSession(session);
    setSessions((prev) => [...prev, session]);
    setScreen("results");
  }

  async function handleFollowUp(answer: Exclude<FollowUp, null>) {
    if (demo) {
      setSessions((current) =>
        current.map((session) =>
          session.id === completedSession?.id ? { ...session, followUp: answer } : session,
        ),
      );
      return;
    }
    const sessionId = serverSession?.id ?? completedSession?.id;
    if (!sessionId) throw new Error("Не удалось определить сессию для follow-up");
    const updated = await saveFollowUp(sessionId, answer);
    setServerSession(updated);
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId ? { ...session, followUp: answer } : session,
      ),
    );
  }

  async function answerDueFollowUp(answer: Exclude<FollowUp, null>) {
    if (!dueFollowUp) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await saveFollowUp(dueFollowUp, answer);
      setDueFollowUp(null);
    } catch (error) {
      applyConflict(error);
    } finally {
      setSyncing(false);
    }
  }

  function handleNavTab(tab: "home" | "stats" | "settings") {
    setNavTab(tab);
    setScreen(tab);
  }

  const showNav = screen === "home" || screen === "stats" || screen === "settings";

  async function updateWakeProfile(input: Omit<WakeProfile, "revision">): Promise<void> {
    setPersonalizationSaving(true);
    try {
      setWakeProfile(
        demo
          ? { ...input, revision: wakeProfile.revision + 1 }
          : await saveWakeProfile(input, wakeProfile.revision),
      );
    } finally {
      setPersonalizationSaving(false);
    }
  }

  function finishOnboarding(): void {
    if (launchSource === "wake") {
      setScreen("startRating");
      return;
    }
    setNavTab("home");
    setScreen("home");
  }

  function openSettings(): void {
    setNavTab("settings");
    setScreen("settings");
  }

  async function updateWakeRoutine(input: Omit<WakeRoutine, "revision">): Promise<void> {
    setPersonalizationSaving(true);
    try {
      setWakeRoutine(
        demo
          ? { ...input, revision: wakeRoutine.revision + 1 }
          : await saveWakeRoutine(input, wakeRoutine.revision),
      );
    } finally {
      setPersonalizationSaving(false);
    }
  }

  if (dueFollowUp && !serverSession) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Проверка подъёма
          </p>
          <h1 className="mt-2 text-2xl font-bold">Ты окончательно проснулся?</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ответ будет связан с сохранённой сессией и поможет честно оценить протокол.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              disabled={syncing}
              onClick={() => void answerDueFollowUp("up")}
              className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"
            >
              <FollowUpIcon answer="up" className="h-5 w-5 text-accent" />
              Да, уже встал
            </button>
            <button
              disabled={syncing}
              onClick={() => void answerDueFollowUp("back")}
              className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"
            >
              <FollowUpIcon answer="back" className="h-5 w-5 text-accent" />
              Снова лёг
            </button>
            <button
              disabled={syncing}
              onClick={() => void answerDueFollowUp("drowsy")}
              className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"
            >
              <FollowUpIcon answer="drowsy" className="h-5 w-5 text-yellow-400" />
              Не лёг, но ещё сонный
            </button>
          </div>
          {syncing && <p className="mt-3 text-xs text-muted-foreground">Сохраняем ответ…</p>}
          {syncError && <p className="mt-3 text-xs text-red-400">{syncError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-[390px] min-h-screen flex flex-col bg-background relative">
        {(syncing || syncError) && (
          <div
            className={`sticky top-0 z-[60] px-4 py-2 text-center text-xs ${syncError ? "bg-red-500/90 text-white" : "bg-primary text-white"}`}
          >
            {syncError ?? "Сохраняем подтверждённое состояние…"}
          </div>
        )}
        {pendingProfileExclusion && (
          <div className="fixed inset-0 z-[80] flex items-end bg-black/65 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Обновить будущие ограничения"
              className="mx-auto w-full max-w-[358px] rounded-3xl border border-border bg-card p-5 shadow-2xl"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Будущие пробуждения
              </p>
              <h2 className="mt-1 text-xl font-bold">
                Больше не предлагать «{TASK_META[pendingProfileExclusion].title}»?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Текущая замена уже сохранена. Ограничение профиля изменится только после отдельного
                подтверждения.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => setPendingProfileExclusion(null)}
                  className="min-h-12 rounded-xl border border-border bg-secondary text-sm font-semibold"
                >
                  Только сейчас
                </button>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void confirmProfileExclusion()}
                  className="min-h-12 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
                >
                  Исключить
                </button>
              </div>
            </div>
          </div>
        )}
        {screen === "home" && (
          <HomeScreen
            onStart={() => setScreen("context")}
            sessions={sessions}
            demo={demo}
            localStorageScope={localStorageScope}
            onOpenSettings={openSettings}
          />
        )}
        {screen === "onboarding" && (
          <Suspense
            fallback={
              <div className="p-5 text-sm text-muted-foreground">Готовим первую настройку…</div>
            }
          >
            <CapabilityOnboardingScreen
              profile={wakeProfile}
              saving={personalizationSaving}
              onSave={updateWakeProfile}
              onCompleted={finishOnboarding}
              showPix={GUIDED_TASK_EXPERIENCE_ENABLED}
            />
          </Suspense>
        )}
        {screen === "context" && (
          <Suspense
            fallback={
              <div className="p-5 text-sm text-muted-foreground">Готовим параметры сессии…</div>
            }
          >
            <WakeContextSheet
              defaultDuration={wakeProfile.defaultDurationMinutes}
              profileComplete={wakeProfile.onboardingCompleted}
              busy={syncing}
              onCancel={() => setScreen("home")}
              onOpenProfile={() => {
                setNavTab("settings");
                setScreen("settings");
              }}
              onStart={(context, duration) => void startSession(context, duration)}
            />
          </Suspense>
        )}
        {screen === "stats" && (
          <StatsScreen sessions={sessions} demo={demo} routine={wakeRoutine} />
        )}
        {screen === "settings" && (
          <LazyBoundary>
            <Suspense
              fallback={
                <div className="p-5 text-sm text-muted-foreground">Загружаем настройки…</div>
              }
            >
              <SettingsScreen
                alarmTime={alarmTime}
                schedule={wakeSchedule}
                saving={scheduleSaving}
                demo={demo}
                onScheduleSave={saveScheduleSetting}
                wakeProfile={wakeProfile}
                wakeRoutine={wakeRoutine}
                personalizationSaving={personalizationSaving}
                onProfileSave={updateWakeProfile}
                onRoutineSave={updateWakeRoutine}
                localStorageScope={localStorageScope}
                goalCalibrationEnabled={GOAL_CALIBRATION_ENABLED}
              />
            </Suspense>
          </LazyBoundary>
        )}
        {screen === "startRating" && (
          <Suspense
            fallback={<div className="p-5 text-sm text-muted-foreground">Готовим оценку…</div>}
          >
            <StartRatingScreen
              onDone={handleStartRating}
              ready={demo || Boolean(serverSession)}
              busy={syncing}
              localStorageScope={localStorageScope}
              soundMode={soundMode}
              onSoundModeChange={setSoundMode}
              goalCalibrationEnabled={GOAL_CALIBRATION_ENABLED}
              guidedExperience={GUIDED_TASK_EXPERIENCE_ENABLED}
              onRetry={
                launchSource === "wake" && !serverSession
                  ? () => void startSession("night_sleep", wakeProfile.defaultDurationMinutes)
                  : undefined
              }
            />
          </Suspense>
        )}
        {screen === "tasks" && (
          <TasksContainer
            key={`${serverSession?.id ?? "demo"}-${taskIndex}-${taskRenderVersion}`}
            taskIds={taskIds}
            taskIndex={taskIndex}
            durationMinutes={serverSession?.durationMinutes ?? activeDurationMinutes}
            soundMode={soundMode}
            onSoundModeChange={setSoundMode}
            submitting={syncing}
            substitutionEnabled={WAKE_TASK_SUBSTITUTION_ENABLED}
            onReplace={(stepIndex, reason) => void handleTaskReplacement(stepIndex, reason)}
            onDone={handleTaskDone}
          />
        )}
        {screen === "endRating" && (
          <Suspense
            fallback={<div className="p-5 text-sm text-muted-foreground">Готовим оценку…</div>}
          >
            <EndRatingScreen startAlertness={startAlertness} onDone={handleEndRating} />
          </Suspense>
        )}
        {screen === "results" && completedSession && (
          <ResultsScreen
            session={completedSession}
            allSessions={sessions}
            onStats={() => handleNavTab("stats")}
            onHome={() => handleNavTab("home")}
            onSettings={() => handleNavTab("settings")}
            onFollowUp={handleFollowUp}
            localStorageScope={localStorageScope}
            routine={wakeRoutine}
            demo={demo}
          />
        )}
        {showNav && <BottomNav current={navTab} onTab={handleNavTab} />}
      </div>
    </div>
  );
}

export default function App() {
  const bootstrap = useBootstrap();
  const launchSource = new URLSearchParams(window.location.search).get("source");
  const [resumeAccepted, setResumeAccepted] = useState(launchSource === "wake");
  const [resumeDiscarded, setResumeDiscarded] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  if (bootstrap.status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-background text-foreground flex items-center justify-center p-6"
      >
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="font-semibold">Загружаем твоё состояние…</p>
          <p className="text-sm text-muted-foreground mt-2">Берём только подтверждённые данные</p>
        </div>
      </div>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <div
        role="alert"
        className="min-h-screen bg-background text-foreground flex items-center justify-center p-6"
      >
        <div className="max-w-sm text-center">
          <AlertCircle className="w-10 h-10 text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold">
            {bootstrap.reason === "timeout"
              ? "Сервер ещё запускается"
              : "Не удалось безопасно войти"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">{bootstrap.message}</p>
          <a
            href="/privacy"
            className="mt-4 block text-sm text-muted-foreground underline underline-offset-4"
          >
            Политика конфиденциальности
          </a>
          <button
            onClick={bootstrap.retry}
            className="mt-6 w-full rounded-2xl bg-primary py-3 font-bold text-white"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (bootstrap.mode === "telegram" && !bootstrap.legal.accepted) {
    return <LegalGate legal={bootstrap.legal} onAccepted={bootstrap.retry} />;
  }

  if (
    bootstrap.mode === "telegram" &&
    bootstrap.data.activeSession &&
    !resumeAccepted &&
    !resumeDiscarded
  ) {
    const active = bootstrap.data.activeSession;
    async function discardActiveSession() {
      setDiscarding(true);
      setDiscardError(null);
      try {
        await abandonWakeSession(active.session.id, active.session.version);
        setResumeDiscarded(true);
      } catch (error) {
        setDiscardError(error instanceof Error ? error.message : "Не удалось завершить сессию");
      } finally {
        setDiscarding(false);
      }
    }
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Сессия сохранена
          </p>
          <h1 className="mt-2 text-2xl font-bold">Продолжить пробуждение?</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Подтверждено шагов: {active.session.currentStepIndex} из {active.protocol.steps.length}.
            Мы продолжим с последней сохранённой точки.
          </p>
          <button
            disabled={discarding}
            onClick={() => setResumeAccepted(true)}
            className="mt-6 w-full rounded-2xl bg-primary py-3 font-bold text-white"
          >
            Продолжить
          </button>
          <button
            disabled={discarding}
            onClick={() => void discardActiveSession()}
            className="mt-2 w-full rounded-2xl bg-secondary py-3 font-semibold text-foreground"
          >
            {discarding ? "Закрываем старую сессию…" : "Начать заново"}
          </button>
          <button
            disabled={discarding}
            onClick={() => void discardActiveSession()}
            className="mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-muted-foreground disabled:opacity-60"
          >
            Закрыть
          </button>
          {discardError && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {discardError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <PrototypeApp
      demo={bootstrap.mode === "demo"}
      localStorageScope={bootstrap.mode === "telegram" ? bootstrap.data.user.id : "demo"}
      {...(bootstrap.mode === "telegram" && bootstrap.data.activeSession && !resumeDiscarded
        ? { resume: bootstrap.data.activeSession }
        : {})}
      {...(bootstrap.mode === "telegram"
        ? {
            dueFollowUpSessionId: bootstrap.data.dueFollowUpSessionId,
            initialWakeSchedule: bootstrap.data.wakeSchedule,
            initialWakeProfile: bootstrap.data.wakeProfile ?? {
              movementLevel: "none",
              availableResources: [],
              excludedTaskIds: [],
              defaultDurationMinutes: 5,
              onboardingCompleted: false,
              revision: 0,
            },
            initialWakeRoutine: bootstrap.data.wakeRoutine ?? {
              enabled: false,
              items: [],
              revision: 0,
            },
          }
        : {
            initialWakeProfile: {
              movementLevel: "full",
              availableResources: ["water", "bright_light", "floor_space"],
              excludedTaskIds: [],
              defaultDurationMinutes: 5,
              onboardingCompleted: true,
              revision: 0,
            },
            initialWakeRoutine: { enabled: false, items: [], revision: 0 },
          })}
    />
  );
}
