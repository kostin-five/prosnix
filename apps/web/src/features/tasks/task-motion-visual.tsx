import { useEffect, useState } from "react";

import { TaskIcon, type TaskId } from "./task-icon.js";

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
      className="relative grid h-20 w-full place-items-center overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/10 to-card"
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
      {movement && (
        <span className="absolute bottom-3 h-px w-28 bg-primary/25" aria-hidden="true" />
      )}
      <div
        className={`relative grid h-12 w-12 place-items-center rounded-xl border border-primary/25 bg-background/80 text-primary shadow-[0_10px_35px_rgba(249,115,22,.14)] ${reduced ? "" : motionClass}`}
        aria-hidden="true"
      >
        <TaskIcon taskId={taskId} className="h-6 w-6" />
      </div>
      <figcaption className="sr-only">{MOTION_LABELS[taskId]}</figcaption>
    </figure>
  );
}

export default TaskMotionVisual;
