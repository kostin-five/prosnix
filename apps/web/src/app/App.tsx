import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  Bell, Home, BarChart2, Flame, Brain, Check, TrendingUp,
  ArrowRight, Sun, Award, ChevronRight, Zap, Activity,
  Loader2, AlertCircle, Sparkles,
} from "lucide-react";
import { useBootstrap } from "../features/bootstrap/use-bootstrap.js";
import { useAnalyticsProfile } from "../features/analytics/use-analytics.js";
import { DeleteProfile } from "../features/profile/delete-profile.js";
import {
  SessionConflictError,
  createWakeSession,
  saveBaseline,
  saveFollowUp,
  savePostRating,
  saveTaskResult,
} from "../features/session/session-api.js";
import type {
  BootstrapResponse,
  WakeSessionResponse,
} from "../shared/api/client.js";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "home" | "alarm" | "startRating" | "tasks" | "endRating" | "results" | "stats";
type TaskId = "math" | "memory" | "stroop" | "reaction" | "steps" | "squats" | "shake" | "water" | "window" | "curtains";
type TaskCategory = "cognitive" | "movement" | "behavioral" | "environment";
type FollowUp = "up" | "back" | "drowsy" | null;
type Confidence = "insufficient" | "low" | "medium" | "high";

interface TaskResult {
  id: TaskId;
  category: TaskCategory;
  correct: number;
  total: number;
  timeMs: number;
}

interface Session {
  id: string;
  date: string;
  wakeTime: string;
  startAlertness: number;   // 1–10: 1 = barely awake, 10 = fully alert
  tasks: TaskResult[];
  endAlertness: number;     // same scale
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

// ─── Task Pool ────────────────────────────────────────────────────────────────
const TASK_META: Record<TaskId, { category: TaskCategory; title: string; subtitle: string; emoji: string }> = {
  math:     { category: "cognitive",   title: "Математика",    subtitle: "Арифметика в уме",            emoji: "🧮" },
  memory:   { category: "cognitive",   title: "Память",        subtitle: "Запомни и воспроизведи",       emoji: "🧠" },
  stroop:   { category: "cognitive",   title: "Внимание",      subtitle: "Тест Струпа",                 emoji: "👁" },
  reaction: { category: "cognitive",   title: "Реакция",       subtitle: "Поймай момент",               emoji: "⚡" },
  steps:    { category: "movement",    title: "Пройтись",      subtitle: "20–30 секунд ходьбы",         emoji: "🚶" },
  squats:   { category: "movement",    title: "Приседания",    subtitle: "5 приседаний",                emoji: "💪" },
  shake:    { category: "movement",    title: "Разминка",      subtitle: "Короткая разминка тела",      emoji: "🤸" },
  water:    { category: "behavioral",  title: "Стакан воды",   subtitle: "Выпить воду",                 emoji: "💧" },
  window:   { category: "environment", title: "К окну",        subtitle: "Дневной свет",                emoji: "☀️" },
  curtains: { category: "environment", title: "Открыть шторы", subtitle: "Впустить утренний свет",      emoji: "🌅" },
};

const CAT_META: Record<TaskCategory, { label: string; emoji: string; color: string; bg: string }> = {
  cognitive:   { label: "Когнитивные", emoji: "🧠", color: "text-accent",    bg: "bg-accent/10"    },
  movement:    { label: "Движение",    emoji: "🚶", color: "text-green-400", bg: "bg-green-500/10" },
  behavioral:  { label: "Поведение",   emoji: "💧", color: "text-blue-400",  bg: "bg-blue-500/10"  },
  environment: { label: "Окружение",   emoji: "☀️", color: "text-yellow-400",bg: "bg-yellow-500/10"},
};

const CONFIRM_CONFIG: Partial<Record<TaskId, { instruction: string; countdown: number; cta: string }>> = {
  steps:    { instruction: "Встаньте и пройдитесь по комнате или коридору 20–30 секунд. Движение активирует тело и кровоток.", countdown: 0, cta: "Прошёл ✓" },
  squats:   { instruction: "Сделайте 5 приседаний медленно, глубоко дыша. Напрягите ноги и выпрямитесь полностью.", countdown: 25, cta: "Сделал ✓" },
  shake:    { instruction: "Потрясите руками, подвигайте плечами и шеей. Разбудите тело за 15 секунд.", countdown: 15, cta: "Готово ✓" },
  water:    { instruction: "Налейте и выпейте полный стакан воды. Тело обезвожено после сна — вода запускает метаболизм.", countdown: 0, cta: "Выпил ✓" },
  window:   { instruction: "Подойдите к окну и смотрите на небо или улицу 30 секунд. Дневной свет — лучший сигнал для биоритмов.", countdown: 30, cta: "Подошёл ✓" },
  curtains: { instruction: "Подойдите к шторам и откройте их полностью. Впустите утренний свет в комнату.", countdown: 0, cta: "Открыл ✓" },
};

// ─── Learning Period Sequences ────────────────────────────────────────────────
const LEARNING_SEQ: TaskId[][] = [
  ["math", "memory"],              // 1: cognitive baseline
  ["steps", "stroop"],             // 2: movement + cognitive
  ["water", "math", "reaction"],   // 3: behavioral + cognitive
  ["steps", "squats", "stroop"],   // 4: movement heavy
  ["window", "steps", "water"],    // 5: environment + movement + behavioral
  ["math", "stroop", "memory"],    // 6: cognitive variety
  ["steps", "water", "stroop"],    // 7: movement + behavioral + cognitive
];

// ─── Mock Session History ─────────────────────────────────────────────────────
const mkTask = (id: TaskId, ms: number, err = 0): TaskResult => ({
  id, category: TASK_META[id].category, correct: Math.max(0, 3 - err), total: 3, timeMs: ms,
});

const MOCK_SESSIONS: Session[] = [
  {
    id: "s1", date: "16 авг", wakeTime: "07:05",
    startAlertness: 3, tasks: [mkTask("math", 52000, 1), mkTask("memory", 38000, 0)],
    endAlertness: 5, followUp: "drowsy", totalMs: 210000,
  },
  {
    id: "s2", date: "17 авг", wakeTime: "07:00",
    startAlertness: 3, tasks: [mkTask("steps", 62000), mkTask("stroop", 28000, 1)],
    endAlertness: 8, followUp: "up", totalMs: 155000,
  },
  {
    id: "s3", date: "18 авг", wakeTime: "07:12",
    startAlertness: 2, tasks: [mkTask("water", 18000), mkTask("math", 65000, 2)],
    endAlertness: 5, followUp: "back", totalMs: 195000,
  },
  {
    id: "s4", date: "19 авг", wakeTime: "07:00",
    startAlertness: 2, tasks: [mkTask("steps", 58000), mkTask("squats", 42000), mkTask("stroop", 24000)],
    endAlertness: 9, followUp: "up", totalMs: 148000,
  },
  {
    id: "s5", date: "20 авг", wakeTime: "07:02",
    startAlertness: 3, tasks: [mkTask("window", 45000), mkTask("steps", 60000), mkTask("water", 12000)],
    endAlertness: 8, followUp: "up", totalMs: 138000,
  },
  {
    id: "s6", date: "21 авг", wakeTime: "07:08",
    startAlertness: 2, tasks: [mkTask("math", 70000, 3), mkTask("stroop", 38000, 2), mkTask("memory", 45000, 1)],
    endAlertness: 5, followUp: "back", totalMs: 228000,
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function makeMathQs() {
  return (["+" as const, "-" as const, "×" as const]).map(op => {
    let a: number, b: number, answer: number, expr: string;
    if (op === "+")  { a = rand(15, 55); b = rand(15, 55); answer = a + b; expr = `${a} + ${b}`; }
    else if (op === "-") { a = rand(40, 90); b = rand(5, 35); answer = a - b; expr = `${a} − ${b}`; }
    else { a = rand(3, 12); b = rand(3, 9); answer = a * b; expr = `${a} × ${b}`; }
    const ds = [3, 5, 7, 9, 11].sort(() => Math.random() - 0.5);
    return {
      expr, answer,
      options: [answer, Math.max(0, answer + (Math.random() > .5 ? ds[0] : -ds[0])), Math.max(0, answer + (Math.random() > .5 ? ds[1] : -ds[1]))].sort(() => Math.random() - 0.5),
    };
  });
}

function makeMemorySeq() { return Array.from({ length: 4 }, () => rand(1, 9)); }

const STROOP = [
  { label: "Красный", value: "red",   cls: "text-red-400"    },
  { label: "Синий",   value: "blue",  cls: "text-blue-400"   },
  { label: "Зелёный", value: "green", cls: "text-green-400"  },
  { label: "Жёлтый",  value: "yell",  cls: "text-yellow-300" },
];
function makeStroopQs() {
  return Array.from({ length: 3 }, () => {
    const word = STROOP[rand(0, 3)];
    let ink = STROOP[rand(0, 3)];
    while (ink.value === word.value) ink = STROOP[rand(0, 3)];
    const opts = [ink, ...STROOP.filter(c => c.value !== ink.value).slice(0, 2)].sort(() => Math.random() - 0.5);
    return { word: word.label.toUpperCase(), inkClass: ink.cls, answer: ink.value, options: opts.map(o => ({ label: o.label, value: o.value })) };
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
  low:          "Низкая уверенность",
  medium:       "Средняя уверенность",
  high:         "Высокая уверенность",
};

function factorLabel(key: string): string {
  const factor = key.split(":")[1] as TaskCategory | undefined;
  return factor && factor in CAT_META ? CAT_META[factor].label : "Фактор протокола";
}

function protocolLabel(key: string): string {
  return key.replace(/^protocol:/, "").replace(/@/, " · версия ");
}

function computeCategoryEffectiveness(sessions: Session[]) {
  const cats: TaskCategory[] = ["cognitive", "movement", "behavioral", "environment"];
  return Object.fromEntries(cats.map(cat => {
    const matching = sessions.filter(s => s.tasks.some(t => t.category === cat));
    if (!matching.length) return [cat, { avgDelta: 0, avgAlertness: 0, sessions: 0, backRate: 0 }];
    const deltas = matching.map(s => s.endAlertness - s.startAlertness);
    const back = matching.filter(s => s.followUp === "back").length;
    return [cat, {
      avgDelta: deltas.reduce((a, b) => a + b, 0) / deltas.length,
      avgAlertness: matching.reduce((a, s) => a + s.endAlertness, 0) / matching.length,
      sessions: matching.length,
      backRate: matching.filter(s => s.followUp !== null).length ? back / matching.filter(s => s.followUp !== null).length : 0,
    }];
  })) as Record<TaskCategory, { avgDelta: number; avgAlertness: number; sessions: number; backRate: number }>;
}

function catEffLabel(avgDelta: number, sessions: number): { text: string; color: string } {
  const conf = getConfidence(sessions);
  if (conf === "insufficient") return { text: "Недостаточно данных", color: "text-muted-foreground" };
  if (avgDelta >= 5) return { text: "Помогает сильнее всего", color: "text-green-400" };
  if (avgDelta >= 3) return { text: "Хороший эффект",         color: "text-green-400" };
  if (avgDelta >= 1) return { text: "Умеренный эффект",       color: "text-yellow-400" };
  return              { text: "Пока слабый эффект",           color: "text-muted-foreground" };
}

function computeNextPlan(sessions: Session[]): { taskIds: TaskId[]; rationale: string; isLearning: boolean } {
  const valid = sessions.filter(s => s.endAlertness > 0);
  if (valid.length < 3) {
    const idx = valid.length < LEARNING_SEQ.length ? valid.length : 0;
    return { taskIds: LEARNING_SEQ[idx % LEARNING_SEQ.length], rationale: "Продолжаем пробовать разные комбинации, чтобы найти, что работает именно для тебя.", isLearning: true };
  }
  const eff = computeCategoryEffectiveness(valid);
  const sorted = (Object.entries(eff) as [TaskCategory, typeof eff[TaskCategory]][])
    .filter(([, d]) => d.sessions >= 2)
    .sort((a, b) => b[1].avgDelta - a[1].avgDelta);
  if (!sorted.length) {
    return { taskIds: LEARNING_SEQ[0], rationale: "Продолжаем изучать разные протоколы.", isLearning: true };
  }
  const [bestCat, bestData] = sorted[0];
  const catFirst: Record<string, TaskId> = { movement: "steps", cognitive: "stroop", behavioral: "water", environment: "window" };
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

// ─── Shared Rating Grid ───────────────────────────────────────────────────────
function RatingGrid({ selected, onSelect }: { selected: number | null; onSelect: (n: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2 mb-3">
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
        const color = n <= 3 ? "text-red-400 bg-red-500/15 border-red-500/40"
          : n <= 6 ? "text-yellow-300 bg-yellow-500/15 border-yellow-500/40"
          : "text-green-400 bg-green-500/15 border-green-500/40";
        return (
          <button key={n} onClick={() => onSelect(n)}
            className={`aspect-square rounded-2xl border text-xl font-bold transition-all duration-150 ${n === selected ? color + " border-2 scale-110 shadow-lg" : "bg-secondary border-border text-foreground active:scale-95"}`}>
            {n}
          </button>
        );
      })}
    </div>
  );
}

// ─── Math Task ────────────────────────────────────────────────────────────────
function MathTask({ onDone }: { onDone: (r: TaskResult) => void }) {
  const [qs] = useState(makeMathQs);
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const correct = useRef(0);
  const t0 = useRef(Date.now());
  function pick(opt: number) {
    if (sel !== null) return;
    setSel(opt);
    if (opt === qs[qi].answer) correct.current++;
    setTimeout(() => {
      if (qi + 1 < qs.length) { setQi(q => q + 1); setSel(null); }
      else onDone({ id: "math", category: "cognitive", correct: correct.current, total: qs.length, timeMs: Date.now() - t0.current });
    }, 600);
  }
  const q = qs[qi];
  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-3">Вопрос {qi + 1} из {qs.length}</p>
        <div className="text-6xl font-extrabold tracking-tight">{q.expr} = ?</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {q.options.map(opt => {
          let cls = "py-5 rounded-2xl text-2xl font-bold text-center transition-all duration-200 ";
          if (!sel)            cls += "bg-secondary text-foreground cursor-pointer active:scale-95";
          else if (opt === q.answer) cls += "bg-green-500/20 text-green-400 border-2 border-green-500/50";
          else if (opt === sel)     cls += "bg-red-500/20 text-red-400 border-2 border-red-500/50";
          else                 cls += "bg-secondary/40 text-muted-foreground";
          return <button key={opt} className={cls} onClick={() => pick(opt)}>{opt}</button>;
        })}
      </div>
    </div>
  );
}

// ─── Memory Task ──────────────────────────────────────────────────────────────
function MemoryTask({ onDone }: { onDone: (r: TaskResult) => void }) {
  const [seq] = useState(makeMemorySeq);
  const [phase, setPhase] = useState<"show" | "recall">("show");
  const [cd, setCd] = useState(4);
  const [entered, setEntered] = useState<number[]>([]);
  const t0 = useRef(Date.now());
  useEffect(() => {
    if (phase !== "show") return;
    if (cd === 0) { setPhase("recall"); return; }
    const t = setTimeout(() => setCd(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cd, phase]);
  function digit(d: number) { if (entered.length < seq.length) setEntered(e => [...e, d]); }
  function submit() {
    const ok = entered.length === seq.length && entered.every((d, i) => d === seq[i]);
    onDone({ id: "memory", category: "cognitive", correct: ok ? 1 : 0, total: 1, timeMs: Date.now() - t0.current });
  }
  if (phase === "show") return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-muted-foreground text-sm">Запомни последовательность</p>
      <div className="flex gap-3">{seq.map((n, i) => (
        <div key={i} className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center text-3xl font-extrabold text-accent">{n}</div>
      ))}</div>
      <div className="text-8xl font-black text-primary">{cd}</div>
      <p className="text-muted-foreground text-sm">сек</p>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-muted-foreground text-sm text-center">Введи запомненную последовательность</p>
      <div className="flex gap-3">{Array.from({ length: seq.length }, (_, i) => (
        <div key={i} className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-extrabold transition-all ${i < entered.length ? "bg-accent/20 border border-accent/30 text-accent" : "bg-secondary border border-border text-muted-foreground"}`}>
          {i < entered.length ? entered[i] : "·"}
        </div>
      ))}</div>
      <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
        {[1,2,3,4,5,6,7,8,9].map(d => (
          <button key={d} onClick={() => digit(d)} className="h-12 rounded-xl text-xl font-semibold bg-secondary text-foreground active:scale-95 transition-transform">{d}</button>
        ))}
        <button onClick={() => setEntered(e => e.slice(0, -1))} className="h-12 rounded-xl text-xl bg-secondary text-muted-foreground active:scale-95 transition-transform">⌫</button>
        <button onClick={() => digit(0)} className="h-12 rounded-xl text-xl font-semibold bg-secondary text-foreground active:scale-95 transition-transform">0</button>
        <button onClick={submit} disabled={entered.length < seq.length}
          className={`h-12 rounded-xl text-xl font-semibold transition-all ${entered.length === seq.length ? "bg-primary text-white active:scale-95" : "bg-secondary/40 text-muted-foreground"}`}>✓</button>
      </div>
    </div>
  );
}

// ─── Stroop Task ──────────────────────────────────────────────────────────────
function StroopTask({ onDone }: { onDone: (r: TaskResult) => void }) {
  const [qs] = useState(makeStroopQs);
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const correct = useRef(0);
  const t0 = useRef(Date.now());
  function pick(val: string) {
    if (sel !== null) return;
    setSel(val);
    if (val === qs[qi].answer) correct.current++;
    setTimeout(() => {
      if (qi + 1 < qs.length) { setQi(q => q + 1); setSel(null); }
      else onDone({ id: "stroop", category: "cognitive", correct: correct.current, total: qs.length, timeMs: Date.now() - t0.current });
    }, 600);
  }
  const q = qs[qi];
  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-6">Вопрос {qi + 1} из {qs.length} — Какого цвета написано слово?</p>
        <div className={`text-5xl font-black tracking-widest ${q.inkClass}`}>{q.word}</div>
        <p className="text-xs text-muted-foreground mt-3">не читай слово — смотри на ЦВЕТ букв</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {q.options.map(opt => {
          let cls = "py-4 rounded-2xl font-semibold text-sm text-center transition-all duration-200 ";
          if (!sel)                   cls += "bg-secondary text-foreground cursor-pointer active:scale-95";
          else if (opt.value === q.answer) cls += "bg-green-500/20 text-green-400 border-2 border-green-500/50";
          else if (opt.value === sel)     cls += "bg-red-500/20 text-red-400 border-2 border-red-500/50";
          else                        cls += "bg-secondary/40 text-muted-foreground";
          return <button key={opt.value} className={cls} onClick={() => pick(opt.value)}>{opt.label}</button>;
        })}
      </div>
    </div>
  );
}

// ─── Reaction Task ────────────────────────────────────────────────────────────
function ReactionTask({ onDone }: { onDone: (r: TaskResult) => void }) {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"wait" | "go" | "early" | "result">("wait");
  const [times, setTimes] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const goAt = useRef(0);
  const t0 = useRef(Date.now());
  useEffect(() => {
    if (phase !== "wait") return;
    const delay = 1500 + Math.random() * 2500;
    timer.current = setTimeout(() => { goAt.current = Date.now(); setPhase("go"); }, delay);
    return () => clearTimeout(timer.current);
  }, [phase, round]);
  function handleTap() {
    if (phase === "wait") {
      clearTimeout(timer.current);
      setPhase("early");
      setTimeout(() => setPhase("wait"), 900);
    } else if (phase === "go") {
      const rt = Date.now() - goAt.current;
      setLastMs(rt);
      const next = [...times, rt];
      setTimes(next);
      if (round + 1 < 3) { setRound(r => r + 1); setTimeout(() => setPhase("wait"), 800); }
      else {
        setPhase("result");
        const avg = next.reduce((s, t) => s + t, 0) / next.length;
        const score = avg < 300 ? 3 : avg < 500 ? 2 : 1;
        setTimeout(() => onDone({ id: "reaction", category: "cognitive", correct: score, total: 3, timeMs: Date.now() - t0.current }), 1200);
      }
    }
  }
  const avgMs = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null;
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-1">Раунд {Math.min(round + 1, 3)} из 3</p>
        <p className="text-xs text-muted-foreground">{phase === "wait" ? "Жди... не нажимай раньше времени" : phase === "early" ? "⚠️ Слишком рано!" : phase === "result" ? `Среднее: ${avgMs} мс` : "Нажимай!"}</p>
      </div>
      <button onClick={handleTap}
        className={`w-48 h-48 rounded-full text-3xl font-extrabold transition-all duration-150 border-4 ${
          phase === "go"    ? "bg-green-500 border-green-400 text-white scale-105 shadow-[0_0_60px_rgba(34,197,94,0.5)]"
          : phase === "early"  ? "bg-red-500/80 border-red-400 text-white"
          : phase === "result" ? "bg-primary/20 border-primary/30 text-primary"
          : "bg-secondary border-border text-muted-foreground"
        }`}>
        {phase === "go" ? "ЖМИ!" : phase === "result" ? (lastMs ? `${lastMs}мс` : "⚡") : phase === "early" ? "Рано!" : "⏳"}
      </button>
      {times.length > 0 && (
        <div className="flex gap-4">
          {times.map((t, i) => (
            <div key={i} className="text-center">
              <div className={`text-lg font-bold ${t < 300 ? "text-green-400" : t < 500 ? "text-yellow-400" : "text-red-400"}`}>{t}мс</div>
              <div className="text-xs text-muted-foreground">R{i + 1}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Confirm Task ─────────────────────────────────────────────────────────────
function ConfirmTask({ taskId, onDone }: { taskId: TaskId; onDone: (r: TaskResult) => void }) {
  const cfg = CONFIRM_CONFIG[taskId]!;
  const meta = TASK_META[taskId];
  const [started, setStarted] = useState(false);
  const [cd, setCd] = useState(cfg.countdown);
  const [done, setDone] = useState(false);
  const t0 = useRef(Date.now());
  useEffect(() => {
    if (!started || cd <= 0) return;
    const t = setTimeout(() => setCd(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [started, cd]);
  function confirm() {
    setDone(true);
    setTimeout(() => onDone({ id: taskId, category: meta.category, correct: 1, total: 1, timeMs: Date.now() - t0.current }), 500);
  }
  if (done) return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
        <Check className="w-10 h-10 text-green-400" strokeWidth={2.5} />
      </div>
      <p className="text-lg font-semibold text-green-400">Готово!</p>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-20 h-20 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-4xl">{meta.emoji}</div>
      <p className="text-sm text-muted-foreground text-center leading-relaxed">{cfg.instruction}</p>
      {cfg.countdown > 0 && started && (
        <div className={`text-7xl font-black transition-colors ${cd === 0 ? "text-green-400" : "text-primary"}`}>
          {cd > 0 ? cd : "✓"}
        </div>
      )}
      {!started ? (
        <button onClick={() => setStarted(true)}
          className="w-full py-4 rounded-2xl text-lg font-bold text-white active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 8px 32px rgba(249,115,22,.25)" }}>
          Начать
        </button>
      ) : (
        <button onClick={confirm} disabled={cfg.countdown > 0 && cd > 0}
          className={`w-full py-4 rounded-2xl text-lg font-bold transition-all ${cfg.countdown > 0 && cd > 0 ? "bg-secondary text-muted-foreground" : "text-white active:scale-[0.98]"}`}
          style={cfg.countdown === 0 || cd === 0 ? { background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 8px 32px rgba(249,115,22,.25)" } : {}}>
          {cfg.cta}
        </button>
      )}
    </div>
  );
}

// ─── Tasks Container ──────────────────────────────────────────────────────────
function TasksContainer({ taskIds, taskIndex, onDone }: {
  taskIds: TaskId[]; taskIndex: number; onDone: (r: TaskResult) => void;
}) {
  const id = taskIds[taskIndex];
  const meta = TASK_META[id];
  const catMeta = CAT_META[meta.category];
  const progress = (taskIndex / taskIds.length) * 100;
  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Шаг {taskIndex + 1} из {taskIds.length}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${catMeta.bg} border-transparent ${catMeta.color}`}>{catMeta.emoji} {catMeta.label}</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/20 flex items-center justify-center text-2xl">{meta.emoji}</div>
        <div>
          <h2 className="text-lg font-bold">{meta.title}</h2>
          <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
        </div>
      </div>
      <div className="flex-1">
        {id === "math"     && <MathTask     key={`${id}-${taskIndex}`} onDone={onDone} />}
        {id === "memory"   && <MemoryTask   key={`${id}-${taskIndex}`} onDone={onDone} />}
        {id === "stroop"   && <StroopTask   key={`${id}-${taskIndex}`} onDone={onDone} />}
        {id === "reaction" && <ReactionTask key={`${id}-${taskIndex}`} onDone={onDone} />}
        {(id === "steps" || id === "squats" || id === "shake" || id === "water" || id === "window" || id === "curtains") &&
          <ConfirmTask key={`${id}-${taskIndex}`} taskId={id} onDone={onDone} />}
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ alarmTime, onTimeChange, onStart, sessions }: {
  alarmTime: string; onTimeChange: (t: string) => void; onStart: () => void; sessions: Session[];
}) {
  const [editing, setEditing] = useState(false);
  const valid = sessions.filter(s => s.endAlertness > 0);
  const streak = valid.length;
  const avgGain = valid.length ? (valid.reduce((s, v) => s + (v.endAlertness - v.startAlertness), 0) / valid.length).toFixed(1) : "—";
  const isLearning = valid.length < 7;
  const lp = Math.min(valid.length, 7);

  return (
    <div className="flex flex-col flex-1 px-5 pt-14 pb-28 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Adaptive Wake Coach</h1>
          <p className="text-sm text-muted-foreground">Учится будить тебя лучше каждое утро</p>
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1.5">
          <Flame className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">{streak}</span>
          <span className="text-xs text-muted-foreground">дней</span>
        </div>
      </div>

      {/* Learning status */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          {isLearning ? <Zap className="w-4 h-4 text-accent" /> : <Sparkles className="w-4 h-4 text-primary" />}
          <p className={`text-sm font-semibold ${isLearning ? "text-accent" : "text-primary"}`}>
            {isLearning ? "🧪 Изучаем твоё пробуждение" : "Первый профиль пробуждения готов"}
          </p>
        </div>
        {isLearning && (
          <div className="flex gap-1.5 mb-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className={`flex-1 h-2 rounded-full ${i < lp ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {isLearning
            ? lp < 7
              ? `${lp} из 7 экспериментов · Пробуем разные комбинации, чтобы понять, что помогает именно тебе.`
              : "7 из 7 · Ещё один шаг до первых выводов!"
            : "Мы уже нашли первые закономерности и продолжим уточнять их каждое утро."}
        </p>
      </div>

      {/* Alarm card */}
      <div className="bg-card border border-border rounded-3xl p-5 mb-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle at 80% 50%, #F97316 0%, transparent 60%)" }} />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Bell className="w-4 h-4" /><span>Будильник</span></div>
          <button onClick={() => setEditing(e => !e)} className="text-xs border border-border rounded-full px-3 py-1 text-muted-foreground hover:text-foreground transition-colors">
            {editing ? "Готово" : "Изменить"}
          </button>
        </div>
        {editing ? (
          <input type="time" value={alarmTime} onChange={e => onTimeChange(e.target.value)} className="text-5xl font-extrabold bg-transparent border-none outline-none text-foreground w-full" />
        ) : (
          <div className="text-6xl font-extrabold tracking-tight">{alarmTime}</div>
        )}
        <div className="flex gap-2 mt-4 flex-wrap">
          {["Пн","Вт","Ср","Чт","Пт"].map(d => (
            <span key={d} className="text-xs font-semibold text-primary bg-primary/15 border border-primary/20 rounded-full px-2.5 py-0.5">{d}</span>
          ))}
          {["Сб","Вс"].map(d => (
            <span key={d} className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">{d}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Средний прирост</p>
          <div className="flex items-end gap-1">
            <span className="text-3xl font-extrabold">{avgGain === "—" ? "—" : `+${avgGain}`}</span>
            {valid.length > 0 && <span className="text-muted-foreground text-sm mb-0.5">балла</span>}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Экспериментов</p>
          <div className="flex items-end gap-1">
            <span className="text-3xl font-extrabold">{valid.length}</span>
            <span className="text-muted-foreground text-sm mb-0.5">/ {isLearning ? "7" : "∞"}</span>
          </div>
        </div>
      </div>

      {/* Mini chart */}
      {valid.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <p className="text-sm font-semibold mb-3">Прирост бодрости по дням</p>
          <div className="flex items-end gap-1.5 h-14">
            {sessions.slice(-7).map((s, i) => {
              const delta = s.endAlertness - s.startAlertness;
              const pct = s.endAlertness > 0 ? Math.max(4, (delta / 8) * 100) : 4;
              const color = delta >= 5 ? "bg-green-500/70" : delta >= 3 ? "bg-primary/70" : delta >= 0 ? "bg-yellow-500/50" : "bg-muted";
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full rounded-sm ${s.endAlertness > 0 ? color : "bg-muted"}`} style={{ height: `${pct}%` }} />
                  <span className="text-xs text-muted-foreground">{s.date.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={onStart}
        className="w-full py-5 rounded-2xl text-lg font-bold text-white flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
        style={{ background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 8px 32px rgba(249,115,22,.25)" }}>
        <Sun className="w-5 h-5" /> Симулировать пробуждение
      </button>
    </div>
  );
}

// ─── Alarm Screen ─────────────────────────────────────────────────────────────
function AlarmScreen({ alarmTime, onBegin }: { alarmTime: string; onBegin: () => void }) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => { const t = setInterval(() => setPulse(p => !p), 900); return () => clearInterval(t); }, []);
  const dateStr = new Date().toLocaleDateString("ru", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 text-center"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(249,115,22,0.12) 0%, transparent 65%)" }}>
      <div className={`w-24 h-24 rounded-full border-2 border-primary/40 flex items-center justify-center mb-8 transition-all duration-700 ${pulse ? "bg-primary/25 shadow-[0_0_40px_rgba(249,115,22,0.3)]" : "bg-primary/10"}`}>
        <Bell className="w-11 h-11 text-primary" />
      </div>
      <p className="text-muted-foreground text-base mb-2 font-medium">Пора вставать!</p>
      <div className="text-7xl font-black tracking-tight mb-3">{alarmTime}</div>
      <p className="text-muted-foreground text-sm mb-14 capitalize">{dateStr}</p>
      <div className="w-full space-y-3">
        <button onClick={onBegin}
          className="w-full py-5 rounded-2xl text-lg font-bold text-white flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 8px 32px rgba(249,115,22,.25)" }}>
          Начать протокол <ArrowRight className="w-5 h-5" />
        </button>
        <button className="w-full py-3.5 text-muted-foreground text-sm rounded-2xl hover:text-foreground transition-colors">
          Отложить на 5 минут
        </button>
      </div>
    </div>
  );
}

// ─── Start Rating ─────────────────────────────────────────────────────────────
function StartRatingScreen({ onDone }: { onDone: (v: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <div className="flex flex-col flex-1 p-6 justify-center">
      <div className="text-center mb-10">
        <div className="text-5xl mb-5">😴</div>
        <h1 className="text-2xl font-bold mb-2">Перед протоколом</h1>
        <p className="text-muted-foreground">Насколько бодрым ты себя чувствуешь прямо сейчас?</p>
      </div>
      <RatingGrid selected={sel} onSelect={setSel} />
      <div className="flex justify-between text-xs text-muted-foreground px-1 mb-8">
        <span>1 — еле проснулся</span><span>10 — полностью бодр</span>
      </div>
      <button onClick={() => sel && onDone(sel)} disabled={!sel}
        className={`w-full py-4 rounded-2xl text-lg font-bold transition-all ${sel ? "text-white active:scale-[0.98]" : "bg-secondary text-muted-foreground"}`}
        style={sel ? { background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 8px 32px rgba(249,115,22,.25)" } : {}}>
        Начать протокол →
      </button>
    </div>
  );
}

// ─── End Rating ───────────────────────────────────────────────────────────────
function EndRatingScreen({ startAlertness, onDone }: { startAlertness: number; onDone: (v: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <div className="flex flex-col flex-1 p-6 justify-center">
      <div className="text-center mb-6">
        <div className="text-5xl mb-5">☀️</div>
        <h1 className="text-2xl font-bold mb-2">Протокол завершён</h1>
        <p className="text-muted-foreground">А сейчас насколько бодрым ты себя чувствуешь?</p>
      </div>
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">Было</div>
          <div className="text-3xl font-black text-muted-foreground">{startAlertness}<span className="text-base">/10</span></div>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground" />
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">Стало</div>
          <div className={`text-3xl font-black ${sel ? (sel > startAlertness ? "text-green-400" : "text-yellow-400") : "text-muted-foreground"}`}>{sel ? `${sel}/10` : "?/10"}</div>
        </div>
        {sel && (
          <>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Эффект</div>
              <div className={`text-3xl font-black ${sel - startAlertness > 0 ? "text-green-400" : "text-red-400"}`}>
                {sel - startAlertness > 0 ? "+" : ""}{sel - startAlertness}
              </div>
            </div>
          </>
        )}
      </div>
      <RatingGrid selected={sel} onSelect={setSel} />
      <div className="flex justify-between text-xs text-muted-foreground px-1 mb-8">
        <span>1 — еле проснулся</span><span>10 — полностью бодр</span>
      </div>
      <button onClick={() => sel && onDone(sel)} disabled={!sel}
        className={`w-full py-4 rounded-2xl text-lg font-bold transition-all ${sel ? "text-white active:scale-[0.98]" : "bg-secondary text-muted-foreground"}`}
        style={sel ? { background: "linear-gradient(135deg,#F97316,#EA580C)", boxShadow: "0 8px 32px rgba(249,115,22,.25)" } : {}}>
        Сохранить результат
      </button>
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────
function ResultsScreen({ session, allSessions, onStats, onHome, onFollowUp }: {
  session: Session;
  allSessions: Session[];
  onStats: () => void;
  onHome: () => void;
  onFollowUp: (answer: Exclude<FollowUp, null>) => Promise<void>;
}) {
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpAns, setFollowUpAns] = useState<FollowUp>(null);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  async function answerFollowUp(answer: Exclude<FollowUp, null>) {
    setFollowUpSaving(true);
    setFollowUpError(null);
    try {
      await onFollowUp(answer);
      setFollowUpAns(answer);
    } catch (error) {
      setFollowUpError(
        error instanceof Error ? error.message : "Ответ пока не сохранён",
      );
    } finally {
      setFollowUpSaving(false);
    }
  }

  const delta = session.endAlertness - session.startAlertness;
  const deltaColor = delta >= 4 ? "text-green-400" : delta >= 2 ? "text-yellow-400" : delta >= 0 ? "text-orange-400" : "text-red-400";
  const validSessions = allSessions.filter(s => s.endAlertness > 0);
  const remaining = Math.max(0, 7 - validSessions.length);

  // Build insight
  let insightTitle = "Сессия сохранена";
  let insightBody = "";
  let insightColor = "border-border bg-secondary/30";
  let insightIcon = "💾";

  if (remaining > 3) {
    insightBody = `Мы пока собираем данные. Ещё ${remaining} пробуждений помогут определить первые закономерности.`;
  } else if (remaining > 0) {
    insightTitle = "Почти готово";
    insightBody = `Ещё ${remaining} эксперимент${remaining === 1 ? "" : "а"} до первых персональных выводов.`;
    insightColor = "border-accent/20 bg-accent/8";
    insightIcon = "🧪";
  } else {
    // Check for patterns in data
    const eff = computeCategoryEffectiveness(validSessions);
    const movEff = eff["movement"];
    const cogEff = eff["cognitive"];
    if (movEff.sessions >= 2 && movEff.avgDelta > cogEff.avgDelta + 1) {
      insightTitle = "Первые наблюдения";
      insightBody = `Движение пока показывает лучший результат: после таких протоколов твоя бодрость повышается на +${movEff.avgDelta.toFixed(1)} балла. Уверенность — ${CONF_LABEL[getConfidence(movEff.sessions)].toLowerCase()}.`;
      insightColor = "border-primary/20 bg-primary/8";
      insightIcon = "📊";
    } else {
      insightBody = "Собираем больше данных для персональных выводов. Продолжаем эксперименты.";
    }
  }

  return (
    <div className="flex flex-col flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="text-center pt-8 mb-8">
        <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
          <Check className="w-8 h-8 text-green-400" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold mb-1">Протокол завершён</h1>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</p>
      </div>

      {/* Before / After / Effect — main result */}
      <div className="bg-card border border-border rounded-3xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-2">До</p>
            <p className="text-4xl font-black text-muted-foreground">{session.startAlertness}<span className="text-lg font-semibold">/10</span></p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-2">После</p>
            <p className="text-4xl font-black text-foreground">{session.endAlertness}<span className="text-lg font-semibold">/10</span></p>
          </div>
          <div className="w-px h-12 bg-border mx-2" />
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-2">Эффект</p>
            <p className={`text-4xl font-black ${deltaColor}`}>{delta >= 0 ? "+" : ""}{delta}</p>
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
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${catMeta.bg} border-transparent`}>
                  <span className="text-sm">{meta.emoji}</span>
                  <span className={`text-xs font-semibold ${catMeta.color}`}>{meta.title}</span>
                </div>
                {i < session.tasks.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight */}
      <div className={`border rounded-2xl p-4 mb-4 ${insightColor}`}>
        <p className="text-xs text-muted-foreground mb-1">{insightIcon} {insightTitle}</p>
        <p className="text-sm text-foreground leading-relaxed">{insightBody}</p>
      </div>

      {/* Follow-up */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        {!followUpAns ? (
          <>
            <p className="text-sm font-semibold mb-1">Через 15 минут мы проверим</p>
            <p className="text-xs text-muted-foreground mb-3">Удалось ли тебе окончательно проснуться — это ключевая метрика.</p>
            {!showFollowUp ? (
              <button onClick={() => setShowFollowUp(true)} className="text-sm text-accent underline underline-offset-2">
                Ответить сейчас
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {([
                  { val: "up" as FollowUp,    emoji: "✅", label: "Да, уже встал" },
                  { val: "back" as FollowUp,  emoji: "🛏", label: "Снова лёг" },
                  { val: "drowsy" as FollowUp,emoji: "😴", label: "Не лёг, но всё ещё очень сонный" },
                ]).map(opt => (
                  <button
                    key={String(opt.val)}
                    onClick={() => opt.val && void answerFollowUp(opt.val)}
                    disabled={followUpSaving}
                    className="w-full py-3 px-4 rounded-xl bg-secondary border border-border text-sm text-left text-foreground active:scale-[0.99] transition-transform">
                    {opt.emoji} {opt.label}
                  </button>
                ))}
                {followUpSaving && <p className="text-xs text-muted-foreground">Сохраняем ответ…</p>}
                {followUpError && <p className="text-xs text-red-400">{followUpError}</p>}
              </div>
            )}
          </>
        ) : (
          <div className={`${followUpAns === "up" ? "text-green-400" : "text-red-400"}`}>
            <p className="text-sm font-semibold">
              {followUpAns === "up" ? "✅ Встал и не лёг обратно" : followUpAns === "back" ? "🛏 Вернулся в кровать" : "😴 Сонный, но не лёг"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Ответ сохранён и учтён в профиле пробуждения</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onHome} className="flex-1 py-4 bg-secondary rounded-2xl font-semibold active:scale-[0.98] transition-transform">На главную</button>
        <button onClick={onStats}
          className="flex-1 py-4 rounded-2xl font-semibold text-white active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}>
          Статистика
        </button>
      </div>
    </div>
  );
}

// ─── Stats Screen ─────────────────────────────────────────────────────────────
function StatsScreen({ sessions, demo }: { sessions: Session[]; demo: boolean }) {
  const analytics = useAnalyticsProfile(!demo);
  const apiProfile = analytics.status === "ready" ? analytics.profile : null;
  const valid = sessions.filter(s => s.endAlertness > 0);
  const evidenceCount = demo
    ? valid.length
    : apiProfile?.averageDelta.evidenceCount ?? 0;
  const isLearning = evidenceCount < 7;

  // Key metrics
  const avgGain = demo
    ? valid.length
      ? valid.reduce((s, v) => s + (v.endAlertness - v.startAlertness), 0) / valid.length
      : 0
    : apiProfile?.averageDelta.value ?? 0;
  const followedUp = valid.filter(s => s.followUp !== null);
  const successRate = demo
    ? followedUp.length
      ? Math.round(followedUp.filter(s => s.followUp === "up").length / followedUp.length * 100)
      : null
    : apiProfile?.riseSuccess.value === null || apiProfile?.riseSuccess.value === undefined
      ? null
      : Math.round(apiProfile.riseSuccess.value * 100);
  const avgMinutes = valid.length ? Math.round(valid.reduce((s, v) => s + v.totalMs, 0) / valid.length / 60000 * 10) / 10 : null;

  // Category profile
  const eff = computeCategoryEffectiveness(demo ? valid : []);
  const sortedCats = (Object.entries(eff) as [TaskCategory, typeof eff[TaskCategory]][])
    .filter(([, d]) => d.sessions > 0)
    .sort((a, b) => b[1].avgDelta - a[1].avgDelta);

  // Best sequence
  const successSessions = valid.filter(s => s.followUp === "up" && s.endAlertness >= 7);
  const hasBestSeq = successSessions.length >= 2;
  const bestSession = hasBestSeq ? successSessions.reduce((a, b) => (b.endAlertness - b.startAlertness) > (a.endAlertness - a.startAlertness) ? b : a) : null;
  const bestAvgDelta = hasBestSeq ? successSessions.reduce((s, v) => s + (v.endAlertness - v.startAlertness), 0) / successSessions.length : 0;
  const bestProtocol = apiProfile?.protocolEffects
    .filter((metric) => metric.value !== null)
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))[0];

  // Chart data
  const chartData = sessions.slice(-7).map((s, i) => ({
    name: `s${i}`, label: s.date.split(" ")[0],
    value: s.endAlertness - s.startAlertness,
  }));

  // Next plan
  const nextPlan = computeNextPlan(sessions);
  const nextTaskMeta = nextPlan.taskIds.map(id => TASK_META[id]);

  return (
    <div className="flex flex-col flex-1 px-5 pt-14 pb-28 overflow-y-auto">
      <h1 className="text-2xl font-bold mb-1">Статистика</h1>
      <p className="text-sm text-muted-foreground mb-6">Что приложение узнало о твоём пробуждении?</p>

      {/* Learning progress */}
      {isLearning && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-accent" /><p className="text-sm font-semibold text-accent">Период изучения</p></div>
          <div className="flex gap-1.5 mb-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className={`flex-1 h-2 rounded-full ${i < evidenceCount ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{evidenceCount}/7 — {evidenceCount < 7 ? `ещё ${7 - evidenceCount} до первого профиля` : "профиль формируется"}</p>
        </div>
      )}

      {/* Three key metrics */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-2" />
          <div className="text-xl font-extrabold">{evidenceCount ? `${avgGain >= 0 ? "+" : ""}${avgGain.toFixed(1)}` : "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Прирост</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
          <Check className="w-4 h-4 text-green-400 mx-auto mb-2" />
          <div className="text-xl font-extrabold">{successRate !== null ? `${successRate}%` : "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Подъём</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3.5 text-center">
          <Activity className="w-4 h-4 text-accent mx-auto mb-2" />
          <div className="text-xl font-extrabold">{avgMinutes !== null ? `${avgMinutes}м` : "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Время</div>
        </div>
      </div>

      {/* Wake-up profile */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-sm font-semibold mb-4">Твой профиль пробуждения</p>
        {!demo && analytics.status === "loading" ? (
          <p className="text-sm text-muted-foreground">Пересчитываем профиль по сохранённым сессиям…</p>
        ) : !demo && analytics.status === "error" ? (
          <p className="text-sm text-red-400">{analytics.message}</p>
        ) : !demo && apiProfile?.factorEffects.length ? (
          apiProfile.factorEffects.map((metric) => {
            const value = metric.value ?? 0;
            return (
              <div key={metric.key} className="flex items-start justify-between py-3 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-semibold">{factorLabel(metric.key)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {CONF_LABEL[metric.confidence]} · {metric.evidenceCount} парных сравнения
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-black ${value >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {value >= 0 ? "+" : ""}{value.toFixed(1)}
                  </span>
                  <p className="text-xs text-muted-foreground">эффект фактора</p>
                </div>
              </div>
            );
          })
        ) : sortedCats.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пройди несколько сессий, чтобы увидеть профиль.</p>
        ) : (
          sortedCats.map(([cat, data]) => {
            const catMeta = CAT_META[cat];
            const conf = getConfidence(data.sessions);
            const eff2 = catEffLabel(data.avgDelta, data.sessions);
            const showNum = conf !== "insufficient" && conf !== "low";
            return (
              <div key={cat} className="flex items-start justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-xl mt-0.5">{catMeta.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold">{catMeta.label}</p>
                    <p className={`text-sm ${eff2.color}`}>{eff2.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{CONF_LABEL[conf]} · {data.sessions} {data.sessions === 1 ? "эксперимент" : data.sessions < 5 ? "эксперимента" : "экспериментов"}</p>
                  </div>
                </div>
                {showNum && (
                  <div className="text-right">
                    <span className={`text-lg font-black ${data.avgDelta >= 3 ? "text-green-400" : "text-yellow-400"}`}>
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

      {/* Best sequence */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-sm font-semibold mb-3">Твой лучший протокол</p>
        {!demo && bestProtocol ? (
          <>
            <p className="text-sm font-semibold text-green-400">{protocolLabel(bestProtocol.key)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Средний прирост бодрости {bestProtocol.value! >= 0 ? "+" : ""}{bestProtocol.value!.toFixed(1)} · {CONF_LABEL[bestProtocol.confidence].toLowerCase()} · {bestProtocol.evidenceCount} сессий.
            </p>
          </>
        ) : demo && hasBestSeq && bestSession ? (
          <>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {bestSession.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-lg">{TASK_META[t.id].emoji}</span>
                  {i < bestSession.tasks.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                </div>
              ))}
              <div className="ml-2 flex flex-wrap gap-1">
                {bestSession.tasks.map((t, i) => (
                  <span key={i} className="text-xs text-muted-foreground">{TASK_META[t.id].title}{i < bestSession.tasks.length - 1 ? " →" : ""}</span>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">После этой последовательности бодрость повышалась на +{bestAvgDelta.toFixed(1)} балла, а ты реже возвращался в кровать.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Мы ещё тестируем разные последовательности. Ответ появится после нескольких успешных сессий.</p>
        )}
      </div>

      {/* Chart */}
      {demo && valid.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-5">
          <p className="text-sm font-semibold mb-4">Прирост бодрости по дням</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={28} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7878A0", fontSize: 12, fontFamily: "inherit" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#7878A0", fontSize: 11, fontFamily: "inherit" }} tickCount={4} />
                <Tooltip
                  contentStyle={{ background: "#12121E", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, color: "#ECEDF5", fontFamily: "inherit", fontSize: 13 }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  formatter={(v: number) => [v > 0 ? `+${v}` : v, "Прирост бодрости"]}
                />
                <Bar dataKey="value" shape={(rawProps: unknown) => {
                  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = rawProps as Partial<Record<"x" | "y" | "width" | "height" | "value", number>>;
                  if (!height || height <= 0) return <g />;
                  const fill = value >= 5 ? "#22C55E" : value >= 3 ? "#F97316" : value >= 0 ? "#EAB308" : "#EF4444";
                  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={5} ry={5} />;
                }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Next experiment */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold">✨ Следующий эксперимент</p>
          </div>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{demo ? "Прототип" : "План обучения"}</span>
        </div>
        {demo ? (
          <>
            <p className="text-xs text-muted-foreground mb-3">Завтра попробуем:</p>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {nextTaskMeta.map((meta, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${CAT_META[meta.category].bg}`}>
                    <span className="text-sm">{meta.emoji}</span>
                    <span className={`text-xs font-semibold ${CAT_META[meta.category].color}`}>{meta.title}</span>
                  </div>
                  {i < nextTaskMeta.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{nextPlan.rationale}</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Следующий протокол назначается сервером по заранее заданному плану сравнений. После достаточного числа сопоставимых сессий здесь появится объяснение выбора; нейросеть сможет сформулировать его, но не изменит исходные метрики.
          </p>
        )}
      </div>

      {/* History */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-semibold mb-3">История пробуждений</p>
        {demo && [...valid].reverse().slice(0, 6).map((s, i) => {
          const delta = s.endAlertness - s.startAlertness;
          const deltaColor2 = delta >= 4 ? "text-green-400" : delta >= 2 ? "text-yellow-300" : "text-red-400";
          return (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{s.date} · {s.wakeTime}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {s.tasks.map(t => <span key={t.id} className="text-base">{TASK_META[t.id].emoji}</span>)}
                  {s.followUp === "back" && <span className="text-xs text-red-400 ml-1">лёг обратно</span>}
                  {s.followUp === "up"   && <span className="text-xs text-green-400 ml-1">встал</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-lg font-black ${deltaColor2}`}>
                  {delta >= 0 ? "+" : ""}{delta}<span className="text-xs text-muted-foreground font-normal"> балла</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          );
        })}
        {(!demo || valid.length === 0) && (
          <p className="text-sm text-muted-foreground">
            {demo ? "Ещё нет завершённых сессий." : "Подробная история появится после подключения серверного списка сессий."}
          </p>
        )}
      </div>
      {!demo && <DeleteProfile />}
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ current, onTab }: { current: "home" | "stats"; onTab: (t: "home" | "stats") => void }) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-50 flex justify-around items-center px-8 py-3"
      style={{ background: "rgba(18,18,30,0.9)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      {([
        { key: "home" as const,  icon: <Home className="w-5 h-5" />,     label: "Главная"     },
        { key: "stats" as const, icon: <BarChart2 className="w-5 h-5" />, label: "Статистика" },
      ]).map(tab => (
        <button key={tab.key} onClick={() => onTab(tab.key)}
          className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-colors ${current === tab.key ? "text-primary" : "text-muted-foreground"}`}>
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
  resume,
  dueFollowUpSessionId,
}: {
  demo: boolean;
  resume?: NonNullable<BootstrapResponse["activeSession"]>;
  dueFollowUpSessionId?: string | null;
}) {
  const resumedTaskIds = (resume?.protocol.steps ?? [])
    .map(({ taskId }) => taskId)
    .filter((taskId): taskId is TaskId => taskId in TASK_META);
  const [screen, setScreen] = useState<Screen>(
    resume
      ? resume.baseline === null
        ? "startRating"
        : resume.session.currentStepIndex >= resumedTaskIds.length
          ? "endRating"
          : "tasks"
      : "home",
  );
  const [navTab, setNavTab] = useState<"home" | "stats">("home");
  const [alarmTime, setAlarmTime] = useState("07:00");
  const [sessions, setSessions] = useState<Session[]>(demo ? MOCK_SESSIONS : []);
  const [serverSession, setServerSession] = useState<WakeSessionResponse | null>(
    resume ? resumedServerSession(resume) : null,
  );
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dueFollowUp, setDueFollowUp] = useState(dueFollowUpSessionId ?? null);

  const [taskIds, setTaskIds] = useState<TaskId[]>(resumedTaskIds);
  const [taskIndex, setTaskIndex] = useState(resume?.session.currentStepIndex ?? 0);
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [startAlertness, setStartAlertness] = useState(resume?.baseline ?? 0);
  const sessionStartRef = useRef(Date.now());
  const [completedSession, setCompletedSession] = useState<Session | null>(null);

  function applyConflict(error: unknown): void {
    if (error instanceof SessionConflictError && error.canonicalSession) {
      setServerSession(error.canonicalSession);
      setTaskIndex(error.canonicalSession.currentStepIndex);
      setTaskIds(
        error.canonicalSession.assignment.steps
          .map(({ taskId }) => taskId)
          .filter((taskId): taskId is TaskId => taskId in TASK_META),
      );
    }
    setSyncError(
      error instanceof Error
        ? error.message
        : "Действие пока не подтверждено сервером",
    );
  }

  async function startSession() {
    setSyncError(null);
    sessionStartRef.current = Date.now();
    if (demo) {
      const ids = selectTasks(sessions.length, sessions);
      setTaskIds(ids);
      setTaskIndex(0);
      setTaskResults([]);
      setStartAlertness(0);
      setScreen("alarm");
      return;
    }
    setSyncing(true);
    try {
      const created = await createWakeSession(
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      );
      setServerSession(created);
      setTaskIds(
        created.assignment.steps
          .map(({ taskId }) => taskId)
          .filter((taskId): taskId is TaskId => taskId in TASK_META),
      );
      setTaskIndex(created.currentStepIndex);
      setTaskResults([]);
      setStartAlertness(0);
      setScreen("alarm");
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
      const updated = await saveBaseline(
        serverSession.id,
        serverSession.version,
        v,
      );
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
    setSyncError(null);
    if (demo) {
      const next = [...taskResults, result];
      setTaskResults(next);
      if (taskIndex + 1 < taskIds.length) setTaskIndex(i => i + 1);
      else setScreen("endRating");
      return;
    }
    if (!serverSession) return;
    setSyncing(true);
    try {
      const updated = await saveTaskResult(
        serverSession.id,
        serverSession.version,
        taskIndex,
        {
          taskId: result.id,
          correct: result.correct,
          total: result.total,
          durationMs: result.timeMs,
        },
      );
      setServerSession(updated);
      setTaskResults((current) => [...current, result]);
      setTaskIndex(updated.currentStepIndex);
      if (updated.currentStepIndex >= taskIds.length) setScreen("endRating");
    } catch (error) {
      applyConflict(error);
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
        const updated = await savePostRating(
          serverSession.id,
          serverSession.version,
          endAlertness,
        );
        setServerSession(updated);
        confirmedTasks = updated.tasks
          .filter(({ taskId }) => taskId in TASK_META)
          .map((task) => ({
            id: task.taskId as TaskId,
            category: task.category,
            correct: task.correct,
            total: task.total,
            timeMs: task.durationMs,
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
    setSessions(prev => [...prev, session]);
    setScreen("results");
  }

  async function handleFollowUp(answer: Exclude<FollowUp, null>) {
    if (demo) {
      setSessions((current) =>
        current.map((session) =>
          session.id === completedSession?.id
            ? { ...session, followUp: answer }
            : session,
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

  function handleNavTab(tab: "home" | "stats") {
    setNavTab(tab);
    setScreen(tab);
  }

  const showNav = screen === "home" || screen === "stats";

  if (dueFollowUp && !serverSession) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Проверка подъёма</p>
          <h1 className="mt-2 text-2xl font-bold">Ты окончательно проснулся?</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ответ будет связан с сохранённой сессией и поможет честно оценить протокол.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button disabled={syncing} onClick={() => void answerDueFollowUp("up")} className="rounded-xl bg-secondary px-4 py-3 text-left">✅ Да, уже встал</button>
            <button disabled={syncing} onClick={() => void answerDueFollowUp("back")} className="rounded-xl bg-secondary px-4 py-3 text-left">🛏 Снова лёг</button>
            <button disabled={syncing} onClick={() => void answerDueFollowUp("drowsy")} className="rounded-xl bg-secondary px-4 py-3 text-left">😴 Не лёг, но ещё сонный</button>
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
          <div className={`sticky top-0 z-[60] px-4 py-2 text-center text-xs ${syncError ? "bg-red-500/90 text-white" : "bg-primary text-white"}`}>
            {syncError ?? "Сохраняем подтверждённое состояние…"}
          </div>
        )}
        {screen === "home"        && <HomeScreen alarmTime={alarmTime} onTimeChange={setAlarmTime} onStart={startSession} sessions={sessions} />}
        {screen === "stats"       && <StatsScreen sessions={sessions} demo={demo} />}
        {screen === "alarm"       && <AlarmScreen alarmTime={alarmTime} onBegin={() => setScreen("startRating")} />}
        {screen === "startRating" && <StartRatingScreen onDone={handleStartRating} />}
        {screen === "tasks"       && <TasksContainer taskIds={taskIds} taskIndex={taskIndex} onDone={handleTaskDone} />}
        {screen === "endRating"   && <EndRatingScreen startAlertness={startAlertness} onDone={handleEndRating} />}
        {screen === "results" && completedSession && (
          <ResultsScreen
            session={completedSession}
            allSessions={sessions}
            onStats={() => handleNavTab("stats")}
            onHome={() => handleNavTab("home")}
            onFollowUp={handleFollowUp}
          />
        )}
        {showNav && <BottomNav current={navTab} onTab={handleNavTab} />}
      </div>
    </div>
  );
}

export default function App() {
  const bootstrap = useBootstrap();
  const [resumeAccepted, setResumeAccepted] = useState(false);

  if (bootstrap.status === "loading") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <AlertCircle className="w-10 h-10 text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold">Не удалось безопасно войти</h1>
          <p className="text-sm text-muted-foreground mt-2">{bootstrap.message}</p>
          <button onClick={bootstrap.retry} className="mt-6 w-full rounded-2xl bg-primary py-3 font-bold text-white">
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (
    bootstrap.mode === "telegram" &&
    bootstrap.data.activeSession &&
    !resumeAccepted
  ) {
    const active = bootstrap.data.activeSession;
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Сессия сохранена</p>
          <h1 className="mt-2 text-2xl font-bold">Продолжить пробуждение?</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Подтверждено шагов: {active.session.currentStepIndex} из {active.protocol.steps.length}.
            Мы продолжим с последней сохранённой точки.
          </p>
          <button onClick={() => setResumeAccepted(true)} className="mt-6 w-full rounded-2xl bg-primary py-3 font-bold text-white">
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  return (
    <PrototypeApp
      demo={bootstrap.mode === "demo"}
      {...(bootstrap.mode === "telegram" && bootstrap.data.activeSession
        ? { resume: bootstrap.data.activeSession }
        : {})}
      {...(bootstrap.mode === "telegram"
        ? { dueFollowUpSessionId: bootstrap.data.dueFollowUpSessionId }
        : {})}
    />
  );
}
