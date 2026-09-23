import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import type { WakeDurationMinutes } from "../../shared/api/client.js";
import type { WakeSoundMode } from "./task-experience-feedback.js";
import type { TaskId } from "./task-icon.js";

const TaskTimerVisual = lazy(() => import("./task-timer-visual.js"));
const GUIDED_TASK_EXPERIENCE_ENABLED =
  import.meta.env.VITE_GUIDED_TASK_EXPERIENCE_ENABLED !== "false";

type ConfirmTaskId = Exclude<TaskId, "math" | "memory" | "stroop" | "reaction">;

const CONFIG: Record<ConfirmTaskId, { instruction: string; countdown: number; cta: string }> = {
  steps: {
    instruction:
      "Встаньте и пройдитесь по комнате или коридору. Шаги не измеряются датчиком — отметьте выполнение честно после таймера.",
    countdown: 20,
    cta: "Прошёл",
  },
  squats: {
    instruction:
      "Сделайте 5 приседаний медленно, глубоко дыша. Напрягите ноги и выпрямитесь полностью.",
    countdown: 20,
    cta: "Сделал",
  },
  shake: {
    instruction: "Потрясите руками, подвигайте плечами и шеей. Разбудите тело за 15 секунд.",
    countdown: 15,
    cta: "Готово",
  },
  water: {
    instruction: "Налейте и выпейте стакан воды, если это подходит вам и не запрещено врачом.",
    countdown: 10,
    cta: "Выпил",
  },
  window: {
    instruction:
      "Откройте шторы или включите яркий свет в комнате и побудьте при свете 30 секунд. Не смотрите прямо на солнце.",
    countdown: 30,
    cta: "Готово",
  },
  curtains: {
    instruction:
      "Откройте шторы и впустите дневной свет. Не смотрите прямо на солнце; если темно, включите яркий свет в комнате.",
    countdown: 0,
    cta: "Открыл",
  },
  sit_edge: {
    instruction:
      "Сядьте на край кровати и поставьте обе стопы на пол. Останьтесь так 10 секунд перед тем, как вставать.",
    countdown: 10,
    cta: "Готово",
  },
  cool_wash: {
    instruction:
      "Умойте лицо комфортно прохладной, не ледяной водой. Не спешите: действие можно подтвердить через 20 секунд.",
    countdown: 20,
    cta: "Умылся",
  },
  pushups: {
    instruction:
      "Сделайте несколько отжиманий под свой уровень: от пола, а если так неудобно — с колен. Двигайтесь спокойно и остановитесь при дискомфорте.",
    countdown: 25,
    cta: "Сделал",
  },
};

const TEN_MINUTE_OVERRIDES: Partial<Record<ConfirmTaskId, (typeof CONFIG)[ConfirmTaskId]>> = {
  steps: {
    instruction:
      "Встаньте и ходите по комнате или коридору одну минуту. Шаги не измеряются датчиком — отметьте выполнение честно после таймера.",
    countdown: 60,
    cta: "Прошёл",
  },
  squats: {
    instruction:
      "Сделайте 10 приседаний медленно, глубоко дыша. Напрягите ноги и выпрямитесь полностью.",
    countdown: 45,
    cta: "Сделал",
  },
  shake: {
    instruction: "Разминайте руки, плечи и шею в течение 30 секунд, не делая резких движений.",
    countdown: 30,
    cta: "Готово",
  },
  window: {
    instruction:
      "Откройте шторы или включите яркий свет в комнате и побудьте при свете одну минуту. Не смотрите прямо на солнце.",
    countdown: 60,
    cta: "Готово",
  },
  curtains: {
    instruction:
      "Откройте шторы и останьтесь при дневном или ярком комнатном свете 30 секунд. Не смотрите прямо на солнце.",
    countdown: 30,
    cta: "Открыл",
  },
  cool_wash: {
    instruction:
      "Умойте лицо комфортно прохладной, не ледяной водой и побудьте у раковины 30 секунд.",
    countdown: 30,
    cta: "Умылся",
  },
  pushups: {
    instruction:
      "Сделайте несколько отжиманий под свой уровень: от пола или с колен. Двигайтесь спокойно и остановитесь при дискомфорте.",
    countdown: 30,
    cta: "Сделал",
  },
};

const CATEGORY: Record<ConfirmTaskId, "movement" | "behavioral" | "environment"> = {
  steps: "movement",
  squats: "movement",
  shake: "movement",
  water: "behavioral",
  window: "environment",
  curtains: "environment",
  sit_edge: "movement",
  cool_wash: "behavioral",
  pushups: "movement",
};

function signalStart(soundMode: WakeSoundMode): void {
  if (!GUIDED_TASK_EXPERIENCE_ENABLED) return;
  void import("./task-experience-feedback.js").then(({ signalTaskFeedback }) => {
    signalTaskFeedback("start", soundMode);
  });
}

export interface ConfirmTaskResult {
  id: TaskId;
  category: "movement" | "behavioral" | "environment";
  correct: 1;
  total: 1;
  timeMs: number;
}

export function ConfirmTask({
  taskId,
  durationMinutes,
  onDone,
  soundMode = "off",
}: {
  taskId: ConfirmTaskId;
  durationMinutes: WakeDurationMinutes;
  onDone: (result: ConfirmTaskResult) => void;
  soundMode?: WakeSoundMode;
}) {
  const cfg =
    durationMinutes === 10 && TEN_MINUTE_OVERRIDES[taskId]
      ? TEN_MINUTE_OVERRIDES[taskId]!
      : CONFIG[taskId];
  const [started, setStarted] = useState(false);
  const [remaining, setRemaining] = useState(cfg.countdown);
  const [done, setDone] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!started || remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1_000);
    return () => clearTimeout(timer);
  }, [started, remaining]);

  const confirm = () => {
    if (done) return;
    setDone(true);
    setTimeout(
      () =>
        onDone({
          id: taskId,
          category: CATEGORY[taskId],
          correct: 1,
          total: 1,
          timeMs: Date.now() - startedAt.current,
        }),
      500,
    );
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-green-500/30 bg-green-500/20">
          <Check className="h-10 w-10 text-green-400" strokeWidth={2.5} />
        </div>
        <p className="text-lg font-semibold text-green-400">Готово!</p>
      </div>
    );
  }

  return (
    <div className="grid min-h-[320px] grid-rows-[64px_minmax(160px,1fr)_64px] gap-4">
      <p className="self-center text-center text-sm leading-relaxed text-muted-foreground">
        {cfg.instruction}
      </p>
      <div className="grid min-h-40 place-items-center">
        {cfg.countdown > 0 && started ? (
          <Suspense
            fallback={
              <div className="grid h-40 w-40 place-items-center text-4xl font-black text-primary">
                {remaining}
              </div>
            }
          >
            <TaskTimerVisual taskId={taskId} remaining={remaining} total={cfg.countdown} />
          </Suspense>
        ) : (
          <p className="max-w-[240px] text-center text-xs leading-relaxed text-muted-foreground">
            Нажми «Начать», когда будешь готов выполнить действие.
          </p>
        )}
      </div>
      {!started ? (
        <button
          onClick={() => {
            setStarted(true);
            startedAt.current = Date.now();
            signalStart(soundMode);
          }}
          className="w-full rounded-2xl py-4 text-lg font-bold text-white transition-transform active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg,#F97316,#EA580C)",
            boxShadow: "0 8px 32px rgba(249,115,22,.25)",
          }}
        >
          Начать
        </button>
      ) : (
        <button
          onClick={confirm}
          disabled={cfg.countdown > 0 && remaining > 0}
          className={`w-full rounded-2xl py-4 text-lg font-bold transition-all ${cfg.countdown > 0 && remaining > 0 ? "bg-secondary text-muted-foreground" : "text-white active:scale-[0.98]"}`}
          style={
            cfg.countdown === 0 || remaining === 0
              ? {
                  background: "linear-gradient(135deg,#F97316,#EA580C)",
                  boxShadow: "0 8px 32px rgba(249,115,22,.25)",
                }
              : {}
          }
        >
          <span className="inline-flex items-center justify-center gap-2">
            {cfg.cta} <Check className="h-5 w-5" />
          </span>
        </button>
      )}
    </div>
  );
}

export default ConfirmTask;
