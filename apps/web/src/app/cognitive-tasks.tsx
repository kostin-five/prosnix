import { taskSuccessTarget } from "@awc/domain";
import { Check, Loader2, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  adaptDifficulty,
  makeMathQuestion,
  makeMemorySequence,
  type DifficultyLevel,
} from "../features/tasks/task-engine.js";
import type { WakeSoundMode } from "../features/tasks/task-experience-feedback.js";
import type { WakeDurationMinutes } from "../shared/api/client.js";

import { makeStroopQs, sendTaskFeedback, type TaskResult } from "./session-model.js";

export function MathTask({
  durationMinutes,
  protocolVersion = 8,
  onDone,
}: {
  durationMinutes: WakeDurationMinutes;
  protocolVersion?: number;
  onDone: (r: TaskResult) => void;
}) {
  const target = taskSuccessTarget("math", durationMinutes, protocolVersion);
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
  protocolVersion = 8,
  onDone,
}: {
  durationMinutes: WakeDurationMinutes;
  protocolVersion?: number;
  onDone: (r: TaskResult) => void;
}) {
  const target = taskSuccessTarget("memory", durationMinutes, protocolVersion);
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
        <div className="flex w-full max-w-sm justify-center gap-2">
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
      <div className="flex w-full max-w-sm justify-center gap-2">
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
  protocolVersion = 8,
  onDone,
}: {
  durationMinutes: WakeDurationMinutes;
  protocolVersion?: number;
  onDone: (r: TaskResult) => void;
}) {
  const target = taskSuccessTarget("stroop", durationMinutes, protocolVersion);
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
  protocolVersion = 8,
  onDone,
  soundMode = "off",
}: {
  durationMinutes: WakeDurationMinutes;
  protocolVersion?: number;
  onDone: (r: TaskResult) => void;
  soundMode?: WakeSoundMode;
}) {
  const target = taskSuccessTarget("reaction", durationMinutes, protocolVersion);
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
        className={`ps-reaction-target w-48 h-48 rounded-full text-3xl font-extrabold transition-all duration-150 border-4 ${
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
