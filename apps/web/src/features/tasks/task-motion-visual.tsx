import { useEffect, useState } from "react";

import { TaskIcon, type TaskId } from "./task-icon.js";
import squatIllustration from "./illustrations/squats.webp";
import pushupIllustration from "./illustrations/pushups.webp";
import stepsIllustration from "./illustrations/steps.webp";
import waterIllustration from "./illustrations/water.webp";
import sitEdgeIllustration from "./illustrations/sit-edge.webp";
import shakeIllustration from "./illustrations/shake.webp";
import coolWashIllustration from "./illustrations/cool-wash.webp";
import daylightIllustration from "./illustrations/daylight.webp";
import breathingIllustration from "./illustrations/breathing.webp";

const ILLUSTRATIONS: Partial<Record<TaskId, { src: string; phases: string }>> = {
  breathing: { src: breathingIllustration, phases: "Сядь удобно · дыши в своём ритме" },
  squats: { src: squatIllustration, phases: "Стоя → присед" },
  pushups: { src: pushupIllustration, phases: "Упор → отжимание" },
  steps: { src: stepsIllustration, phases: "Шаг за шагом" },
  water: { src: waterIllustration, phases: "Возьми воду → выпей" },
  sit_edge: { src: sitEdgeIllustration, phases: "Сядь и поставь стопы на пол" },
  shake: { src: shakeIllustration, phases: "Опусти руки → мягко подними" },
  cool_wash: { src: coolWashIllustration, phases: "Набери воду → умой лицо" },
  window: { src: daylightIllustration, phases: "Открой шторы → побудь при свете" },
  curtains: { src: daylightIllustration, phases: "Открой шторы → впусти свет" },
};

const MOTION_LABELS: Record<TaskId, string> = {
  breathing: "Дыши мягко в своём ритме",
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
  notice_three: "Заметь три предмета вокруг",
  find_color: "Найди пять предметов одного цвета",
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
  const illustration = ILLUSTRATIONS[taskId];
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
      className="relative grid h-full w-full place-items-center overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/10 to-card"
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
      {illustration ? (
        <div
          className="ps-task-illustration"
          data-testid="task-illustration"
          data-single-pose={taskId === "breathing" ? "true" : undefined}
        >
          <img src={illustration.src} alt="" loading="eager" decoding="async" />
          <span>{illustration.phases}</span>
        </div>
      ) : (
        <div
          className={`ps-task-symbol relative grid place-items-center text-primary ${reduced ? "" : motionClass}`}
          aria-hidden="true"
        >
          <TaskIcon taskId={taskId} className="h-16 w-16" />
        </div>
      )}
      <figcaption className="sr-only">{MOTION_LABELS[taskId]}</figcaption>
    </figure>
  );
}

export default TaskMotionVisual;
