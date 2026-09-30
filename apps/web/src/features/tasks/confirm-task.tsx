import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

import type { WakeDurationMinutes } from "../../shared/api/client.js";
import { estimatedTaskSeconds } from "@awc/domain";
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
  notice_three: {
    instruction:
      "Оглянись и назови про себя три предмета, которые видишь рядом. Говорить вслух не нужно.",
    countdown: 60,
    cta: "Готово",
  },
  find_color: {
    instruction:
      "Выбери любой цвет и найди вокруг пять предметов этого цвета. Можно просто посмотреть по сторонам.",
    countdown: 60,
    cta: "Готово",
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

const COMPACT_FIVE_MINUTE_OVERRIDES: Partial<
  Record<ConfirmTaskId, (typeof CONFIG)[ConfirmTaskId]>
> = {
  steps: {
    instruction:
      "Пройдись по комнате или коридору 40 секунд в спокойном темпе. Отметь выполнение после таймера.",
    countdown: 40,
    cta: "Прошёл",
  },
  squats: {
    instruction: "Сделай до 8 спокойных приседаний. Остановись, если движение некомфортно.",
    countdown: 35,
    cta: "Сделал",
  },
  shake: {
    instruction: "Мягко разминай руки, плечи и шею 30 секунд, без резких движений.",
    countdown: 30,
    cta: "Готово",
  },
  water: {
    instruction: "Налей воду и сделай несколько глотков в удобном темпе.",
    countdown: 25,
    cta: "Выпил",
  },
  window: {
    instruction:
      "Открой шторы или включи яркий свет и побудь при нём 45 секунд. Не смотри прямо на солнце.",
    countdown: 45,
    cta: "Готово",
  },
  cool_wash: {
    instruction:
      "Умой лицо комфортно прохладной водой. Не спеши: подтвердить можно через 30 секунд.",
    countdown: 30,
    cta: "Умылся",
  },
  pushups: {
    instruction:
      "Сделай несколько отжиманий под свой уровень от пола или с колен. Остановись при дискомфорте.",
    countdown: 35,
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
  notice_three: "behavioral",
  find_color: "environment",
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
  completionSource?: "manual" | "timer";
}

export function ConfirmTask({
  taskId,
  durationMinutes,
  protocolVersion = 8,
  onDone,
  soundMode = "off",
  actionContainer,
  interactionMode = "manual",
  autoStart = false,
  preparing = false,
}: {
  taskId: ConfirmTaskId;
  durationMinutes: WakeDurationMinutes;
  protocolVersion?: number;
  onDone: (result: ConfirmTaskResult) => void;
  soundMode?: WakeSoundMode;
  actionContainer?: HTMLElement | null;
  interactionMode?: "manual" | "hands_free";
  autoStart?: boolean;
  preparing?: boolean;
}) {
  const cfg =
    durationMinutes === 5 && protocolVersion >= 10 && COMPACT_FIVE_MINUTE_OVERRIDES[taskId]
      ? COMPACT_FIVE_MINUTE_OVERRIDES[taskId]!
      : durationMinutes === 10 && TEN_MINUTE_OVERRIDES[taskId]
        ? TEN_MINUTE_OVERRIDES[taskId]!
        : CONFIG[taskId];
  const countdown =
    interactionMode === "hands_free"
      ? estimatedTaskSeconds(taskId, durationMinutes, protocolVersion)
      : cfg.countdown;
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(countdown);
  const [done, setDone] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!started || paused || remaining <= 0) return;
    const timer = setTimeout(() => {
      if (document.visibilityState === "hidden") setPaused(true);
      else {
        if (interactionMode === "hands_free" && remaining <= 3) {
          void import("./task-experience-feedback.js").then(({ playCountdownTick }) =>
            playCountdownTick(soundMode),
          );
        }
        setRemaining((value) => value - 1);
      }
    }, 1_000);
    return () => clearTimeout(timer);
  }, [started, paused, remaining, interactionMode, soundMode]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  useEffect(() => {
    if (!autoStart || preparing || started) return;
    setStarted(true);
    startedAt.current = Date.now();
    if (document.visibilityState === "hidden") setPaused(true);
    signalStart(soundMode);
  }, [autoStart, preparing, started, soundMode]);

  const confirm = (source: "manual" | "timer" = "manual") => {
    if (done) return;
    setDone(true);
    onDone({
      id: taskId,
      category: CATEGORY[taskId],
      correct: 1,
      total: 1,
      timeMs:
        source === "timer"
          ? Math.max(Date.now() - startedAt.current, countdown * 1_000)
          : Date.now() - startedAt.current,
      ...(source === "timer" ? { completionSource: "timer" as const } : {}),
    });
  };

  useEffect(() => {
    if (interactionMode === "hands_free" && started && !paused && remaining === 0 && !done) {
      confirm("timer");
    }
  }, [interactionMode, started, paused, remaining, done]);

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-green-500/30 bg-green-500/20">
          <Check className="h-10 w-10 text-green-400" strokeWidth={2.5} />
        </div>
        <p className="text-lg font-semibold text-green-400">Сохраняем шаг…</p>
      </div>
    );
  }

  const action = !started ? (
    <button
      type="button"
      onClick={() => {
        setStarted(true);
        startedAt.current = Date.now();
        signalStart(soundMode);
      }}
      className="ps-primary-button w-full"
    >
      Начать
    </button>
  ) : (
    <button
      type="button"
      onClick={() => confirm()}
      disabled={countdown > 0 && remaining > 0}
      className="ps-primary-button w-full"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {cfg.cta} <Check className="h-5 w-5" />
      </span>
    </button>
  );

  return (
    <div className="ps-confirm-task flex flex-col gap-3">
      <p className="self-center text-center text-sm leading-relaxed text-muted-foreground">
        {cfg.instruction}
      </p>
      <div className="ps-confirm-timer flex min-h-32 items-center justify-center">
        {countdown > 0 ? (
          <button
            type="button"
            aria-label={paused ? "Продолжить таймер" : "Поставить таймер на паузу"}
            aria-pressed={paused}
            disabled={!started || remaining === 0}
            onClick={() => setPaused((value) => !value)}
            className="rounded-full disabled:cursor-default"
          >
            <Suspense
              fallback={
                <div className="grid h-40 w-40 place-items-center text-4xl font-black text-primary">
                  {remaining}
                </div>
              }
            >
              <TaskTimerVisual
                taskId={taskId}
                remaining={remaining}
                total={countdown}
                waiting={!started}
                paused={paused}
              />
            </Suspense>
          </button>
        ) : (
          <p className="max-w-[240px] text-center text-xs leading-relaxed text-muted-foreground">
            Нажми «Начать», когда будешь готов выполнить действие.
          </p>
        )}
      </div>
      {!preparing &&
        (interactionMode !== "hands_free" || !autoStart) &&
        (actionContainer ? createPortal(action, actionContainer) : action)}
      {interactionMode === "hands_free" && paused && (
        <p className="text-center text-xs text-primary">
          Пауза. Нажми на таймер, чтобы продолжить.
        </p>
      )}
    </div>
  );
}

export default ConfirmTask;
