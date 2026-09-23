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
  const water = taskId === "water" || taskId === "cool_wash";
  const seated = taskId === "sit_edge";
  const reaction = taskId === "reaction";

  return (
    <figure
      className="relative grid h-28 w-full place-items-center overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-b from-primary/10 to-card"
      aria-label={MOTION_LABELS[taskId]}
      data-testid="task-motion-visual"
      data-task-motion={taskId}
      data-motion={reduced ? "reduced" : "animated"}
    >
      {light && (
        <span
          className={`absolute h-20 w-20 rounded-full bg-amber-300/25 blur-xl ${reduced ? "" : "animate-pulse"}`}
          aria-hidden="true"
        />
      )}
      {movement && (
        <span
          className={`absolute h-16 w-16 rounded-full border border-primary/30 ${reduced ? "" : "animate-ping"}`}
          aria-hidden="true"
        />
      )}
      {reaction && (
        <span
          className={`absolute h-16 w-16 rounded-full bg-green-400/15 ${reduced ? "" : "animate-pulse"}`}
          aria-hidden="true"
        />
      )}
      <div
        className={`relative grid h-16 w-16 place-items-center rounded-2xl border border-primary/25 bg-background/80 text-primary shadow-[0_10px_35px_rgba(249,115,22,.14)] ${reduced ? "" : movement || seated ? "animate-bounce" : water ? "animate-pulse" : ""}`}
        aria-hidden="true"
      >
        <TaskIcon taskId={taskId} className="h-8 w-8" />
      </div>
      <figcaption className="sr-only">{MOTION_LABELS[taskId]}</figcaption>
    </figure>
  );
}

export default TaskMotionVisual;
