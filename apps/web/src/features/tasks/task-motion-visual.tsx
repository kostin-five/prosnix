import { useEffect, useState } from "react";

import { TaskIcon, type TaskId } from "./task-icon.js";

function MovementDemo({ taskId, reduced }: { taskId: TaskId; reduced: boolean }) {
  const pose =
    taskId === "squats"
      ? {
          first: "M80 23v25m0 0-15 34m15-34 15 34M80 32l-22 17m22-17 22 17",
          second: "M80 37v21m0 0-23 5-4 19m27-24 23 5 4 19M80 43l-23 8m23-8 23 8",
          headFirst: 16,
          headSecond: 30,
          label: "Стоя → присед",
        }
      : taskId === "pushups"
        ? {
            first: "M43 42 95 48 122 76M95 48 88 76m-45-34-10 34m10-34 11 34",
            second: "M43 58 95 58 122 76M95 58 88 76m-45-18-19 18m19-18 19 18",
            headFirst: 38,
            headSecond: 54,
            label: "Опустись → выпрямись",
          }
        : taskId === "steps"
          ? {
              first: "M80 24v25m0 0-23 31m23-31 23 31M80 31 64 51m16-20 16 20",
              second: "M80 24v25m0 0-12 31m12-31 30 25M80 31 58 45m22-14 24 13",
              headFirst: 17,
              headSecond: 17,
              label: "Шагай в спокойном темпе",
            }
          : taskId === "shake"
            ? {
                first: "M80 23v25m0 0-16 32m16-32 16 32M80 30 55 35m25-5 25 5",
                second: "M80 23v25m0 0-16 32m16-32 16 32M80 30 58 18m22 12 22-12",
                headFirst: 16,
                headSecond: 16,
                label: "Поднимай и опускай руки",
              }
            : null;
  if (!pose) return null;

  const headX = taskId === "pushups" ? 33 : 80;
  return (
    <div className="flex flex-col items-center gap-0.5" aria-hidden="true">
      <svg viewBox="0 0 160 90" className="h-16 w-36 text-primary" fill="none">
        <path d="M20 82h120" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
        <g className={reduced ? "" : "task-pose-first"}>
          <circle cx={headX} cy={pose.headFirst} r="7" stroke="currentColor" strokeWidth="3" />
          <path
            d={pose.first}
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        {!reduced && (
          <g className="task-pose-second">
            <circle cx={headX} cy={pose.headSecond} r="7" stroke="currentColor" strokeWidth="3" />
            <path
              d={pose.second}
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}
      </svg>
      <span className="text-[10px] font-medium text-primary/80">{pose.label}</span>
    </div>
  );
}

const MOTION_LABELS: Record<TaskId, string> = {
  math: "Сфокусируйся на примере",
  memory: "Запомни последовательность",
  stroop: "Смотри на цвет букв",
  reaction: "Дождись сигнала",
  steps: "Иди в спокойном темпе",
  squats: "Двигайся ровно и без рывков",
  shake: "Мягко разомни тело",
  water: "Возьми воду и сделай несколько глотков",
  window: "Добавь яркий свет вокруг себя",
  curtains: "Открой шторы и впусти свет",
  sit_edge: "Сядь и поставь стопы на пол",
  cool_wash: "Умой лицо прохладной водой",
  pushups: "Выбери опору под свой уровень",
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function TaskMotionVisual({ taskId }: { taskId: TaskId }) {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const light = taskId === "window" || taskId === "curtains";
  const movement =
    taskId === "steps" || taskId === "squats" || taskId === "shake" || taskId === "pushups";
  const motionClass =
    taskId === "steps"
      ? "task-motion-walk"
      : taskId === "squats" || taskId === "pushups"
        ? "task-motion-reps"
        : taskId === "shake"
          ? "task-motion-shake"
          : taskId === "water" || taskId === "cool_wash"
            ? "task-motion-water"
            : taskId === "window" || taskId === "curtains"
              ? "task-motion-light"
              : "task-motion-settle";

  return (
    <figure
      className="relative grid h-24 w-full place-items-center overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/10 to-card"
      aria-label={MOTION_LABELS[taskId]}
      data-testid="task-motion-visual"
      data-task-motion={taskId}
      data-motion={reduced ? "reduced" : "animated"}
    >
      {light && (
        <span
          className={`absolute h-20 w-20 rounded-full bg-amber-300/25 blur-xl ${reduced ? "" : "task-motion-glow"}`}
          aria-hidden="true"
        />
      )}
      {movement ? (
        <MovementDemo taskId={taskId} reduced={reduced} />
      ) : (
        <div
          className={`relative grid h-12 w-12 place-items-center rounded-xl border border-primary/25 bg-background/80 text-primary shadow-[0_10px_35px_rgba(249,115,22,.14)] ${reduced ? "" : motionClass}`}
          aria-hidden="true"
        >
          <TaskIcon taskId={taskId} className="h-6 w-6" />
        </div>
      )}
      <figcaption className="sr-only">{MOTION_LABELS[taskId]}</figcaption>
    </figure>
  );
}

export default TaskMotionVisual;
