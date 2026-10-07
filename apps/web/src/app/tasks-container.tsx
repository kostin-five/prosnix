import { estimatedTaskSeconds, taskSuccessTarget } from "@awc/domain";
import { ChevronRight, RefreshCw, X } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import type { WakeSoundMode } from "../features/tasks/task-experience-feedback.js";
import type { TaskSubstitutionReason } from "../features/tasks/task-substitution-sheet.js";
import { readTransitionPause } from "../features/tasks/transition-preference.js";
import type { WakeDurationMinutes } from "../shared/api/client.js";
const GUIDED_TASK_EXPERIENCE_ENABLED =
  import.meta.env.VITE_GUIDED_TASK_EXPERIENCE_ENABLED !== "false";

const TaskMotionVisual = lazy(() => import("../features/tasks/task-motion-visual.js"));
const TaskSoundToggle = lazy(() => import("../features/tasks/task-sound-toggle.js"));
const ProtocolSheet = lazy(() => import("../features/tasks/protocol-sheet.js"));
const TaskSubstitutionSheet = lazy(() => import("../features/tasks/task-substitution-sheet.js"));
const ConfirmTask = lazy(() => import("../features/tasks/confirm-task.js"));

import { MathTask, MemoryTask, ReactionTask, StroopTask } from "./cognitive-tasks.js";
import { TASK_META, type TaskId, type TaskResult } from "./session-model.js";

function taskTargetLabel(
  taskId: TaskId,
  durationMinutes: WakeDurationMinutes,
  protocolVersion: number,
): string | null {
  if (taskId !== "math" && taskId !== "memory" && taskId !== "stroop" && taskId !== "reaction") {
    return null;
  }
  const target = taskSuccessTarget(taskId, durationMinutes, protocolVersion);
  if (taskId === "memory") return `${target} правильные последовательности`;
  if (taskId === "math") {
    return `${target} правильных ${target === 5 ? "примеров" : "примера"}`;
  }
  return `${target} успешных ${target === 5 ? "раундов" : "раунда"}`;
}

function approximateRemainingLabel(seconds: number): string {
  if (seconds < 60) return `≈ ${seconds} сек осталось`;
  const minutes = Math.floor(seconds / 60);
  const roundedSeconds = Math.round((seconds % 60) / 10) * 10;
  if (roundedSeconds === 60) return `≈ ${minutes + 1} мин осталось`;
  return roundedSeconds === 0
    ? `≈ ${minutes} мин осталось`
    : `≈ ${minutes} мин ${roundedSeconds} сек осталось`;
}

export function TasksContainer({
  taskIds,
  taskIndex,
  durationMinutes,
  protocolVersion = 8,
  onDone,
  soundMode = "off",
  onSoundModeChange = () => undefined,
  onReplace,
  substitutionEnabled = false,
  submitting = false,
  guidedExperience = GUIDED_TASK_EXPERIENCE_ENABLED,
  interactionMode = "manual",
  localStorageScope = "demo",
  autoResumeBlocked = false,
  onResumeAuto = () => undefined,
  notice = null,
  onDismissNotice = () => undefined,
  onAwakened,
}: {
  taskIds: TaskId[];
  taskIndex: number;
  durationMinutes: WakeDurationMinutes;
  protocolVersion?: number;
  onDone: (r: TaskResult) => void;
  soundMode?: WakeSoundMode;
  onSoundModeChange?: (mode: WakeSoundMode) => void;
  onReplace?: (stepIndex: number, reason: TaskSubstitutionReason) => void;
  substitutionEnabled?: boolean;
  submitting?: boolean;
  guidedExperience?: boolean;
  interactionMode?: "manual" | "hands_free";
  localStorageScope?: string;
  autoResumeBlocked?: boolean;
  onResumeAuto?: () => void;
  notice?: string | null;
  onDismissNotice?: () => void;
  onAwakened?: () => void;
}) {
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [replacementTarget, setReplacementTarget] = useState<number | null>(null);
  const [taskActionContainer, setTaskActionContainer] = useState<HTMLDivElement | null>(null);
  const [preparingSeconds, setPreparingSeconds] = useState<number>(
    taskIndex > 0 ? readTransitionPause(localStorageScope, interactionMode === "hands_free") : 0,
  );
  const [preparationPaused, setPreparationPaused] = useState(false);
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [currentStepRemaining, setCurrentStepRemaining] = useState<number | null>(null);
  const [taskPaused, setTaskPaused] = useState(false);
  useEffect(() => {
    if (interactionMode !== "hands_free" || soundMode !== "on" || taskPaused || preparationPaused) {
      void import("../features/tasks/hands-free-audio.js").then(({ stopSpeech }) => stopSpeech());
      return;
    }
    let active = true;
    void import("../features/tasks/hands-free-audio.js").then(({ speakTask }) => {
      if (active)
        setSpeechUnavailable(
          !speakTask(
            taskIds[taskIndex]!,
            TASK_META[taskIds[taskIndex]!].title,
            localStorageScope,
            taskIndex > 0,
            estimatedTaskSeconds(taskIds[taskIndex]!, durationMinutes, protocolVersion),
          ),
        );
    });
    return () => {
      active = false;
      void import("../features/tasks/hands-free-audio.js").then(({ stopSpeech }) => stopSpeech());
    };
  }, [
    interactionMode,
    soundMode,
    taskIds,
    taskIndex,
    localStorageScope,
    taskPaused,
    preparationPaused,
  ]);
  useEffect(() => {
    if (preparingSeconds === 0 || preparationPaused || autoResumeBlocked) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") setPreparationPaused(true);
      else setPreparingSeconds((seconds) => seconds - 1);
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [interactionMode, preparingSeconds, preparationPaused, autoResumeBlocked]);
  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === "hidden") setPreparationPaused(true);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);
  useEffect(() => {
    if (soundMode !== "on" || taskPaused || preparationPaused) return;
    let active = true;
    void import("../features/tasks/task-experience-feedback.js").then(
      ({ startWakeProtocolSound, stopWakeProtocolSound }) => {
        if (!active) return;
        setAudioUnavailable(!startWakeProtocolSound(interactionMode === "hands_free"));
        const onVisibilityChange = () => {
          if (document.visibilityState === "hidden") stopWakeProtocolSound();
          else setAudioUnavailable(!startWakeProtocolSound(interactionMode === "hands_free"));
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        cleanup = () => {
          document.removeEventListener("visibilitychange", onVisibilityChange);
          stopWakeProtocolSound();
        };
      },
    );
    let cleanup = () => undefined;
    return () => {
      active = false;
      cleanup();
    };
  }, [soundMode, interactionMode, taskPaused, preparationPaused]);
  const id = taskIds[taskIndex];
  const nextId = taskIds[taskIndex + 1];
  const meta = TASK_META[id];
  const plannedSeconds = taskIds.map((taskId) =>
    estimatedTaskSeconds(taskId, durationMinutes, protocolVersion),
  );
  const plannedTotal = plannedSeconds.reduce((total, seconds) => total + seconds, 0);
  const plannedCompleted = plannedSeconds
    .slice(0, taskIndex)
    .reduce((total, seconds) => total + seconds, 0);
  const plannedRemaining =
    preparingSeconds +
    Math.max(0, taskIds.length - taskIndex - 1) *
      readTransitionPause(localStorageScope, interactionMode === "hands_free") +
    (currentStepRemaining ?? plannedSeconds[taskIndex] ?? 0) +
    plannedSeconds.slice(taskIndex + 1).reduce((total, seconds) => total + seconds, 0);
  const progress = plannedTotal === 0 ? 0 : (plannedCompleted / plannedTotal) * 100;
  const remainingLabel = approximateRemainingLabel(plannedRemaining);
  const completeTask = (result: TaskResult) => {
    if (submitting) return;
    onDone(result);
  };
  return (
    <div
      className="ps-protocol ps-task-screen flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-3"
      data-current-task={taskIds[taskIndex]}
      aria-busy={submitting}
    >
      <div className="ps-task-top mb-3">
        <div className="ps-task-toolbar mb-2 flex items-center justify-between gap-2">
          <span className="min-w-0 text-[11px] text-muted-foreground">
            Шаг {taskIndex + 1} из {taskIds.length} · {remainingLabel}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={protocolOpen}
              onClick={() => setProtocolOpen(true)}
              className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border bg-card px-2 text-xs font-semibold text-foreground active:scale-[0.98]"
            >
              Протокол
              <ChevronRight className="h-4 w-4 text-primary" />
            </button>
            {guidedExperience && (
              <Suspense fallback={<div className="h-9 w-20 rounded-xl bg-card" />}>
                <TaskSoundToggle compact mode={soundMode} onChange={onSoundModeChange} />
              </Suspense>
            )}
          </div>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {protocolOpen && (
          <Suspense fallback={null}>
            <ProtocolSheet
              steps={taskIds.map((taskId) => ({ taskId, title: TASK_META[taskId].title }))}
              currentIndex={taskIndex}
              onClose={() => setProtocolOpen(false)}
              onAwakened={onAwakened}
              busy={submitting}
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
      <div className="ps-task-title mb-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">{meta.title}</h2>
          <p className="text-xs text-muted-foreground">
            {taskTargetLabel(id, durationMinutes, protocolVersion) ?? meta.subtitle}
          </p>
        </div>
        {substitutionEnabled && onReplace && id !== "sit_edge" && (
          <button
            type="button"
            onClick={() => setReplacementTarget(taskIndex)}
            disabled={submitting}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl border border-border bg-card px-2 text-xs font-semibold text-foreground disabled:opacity-50 active:scale-[0.98]"
          >
            <RefreshCw className="h-3.5 w-3.5 text-primary" />
            Заменить
          </button>
        )}
      </div>
      {preparingSeconds > 0 && (
        <button
          type="button"
          onClick={() => setPreparationPaused((paused) => !paused)}
          className="mb-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-left text-sm text-primary"
          aria-pressed={preparationPaused}
        >
          {preparationPaused
            ? "Подготовка на паузе · нажми, чтобы продолжить"
            : `Приготовься: ${meta.title} · ${preparingSeconds} сек`}
        </button>
      )}
      {interactionMode === "hands_free" && soundMode === "on" && speechUnavailable && (
        <p
          className="mb-2 rounded-xl border border-amber-500/30 p-3 text-xs text-amber-300"
          role="status"
        >
          На этом устройстве озвучка недоступна. Следи за заданиями на экране.
        </p>
      )}
      {interactionMode === "hands_free" && soundMode === "on" && audioUnavailable && (
        <p
          className="mb-2 rounded-xl border border-amber-500/30 p-3 text-xs text-amber-300"
          role="status"
        >
          Фоновый звук недоступен на этом устройстве. Протокол можно продолжить по экрану.
        </p>
      )}
      {interactionMode === "hands_free" && autoResumeBlocked && (
        <button type="button" onClick={onResumeAuto} className="ps-primary-button mb-2 w-full">
          Продолжить протокол
        </button>
      )}
      {notice && (
        <div
          role="status"
          className="ps-task-notice mb-3 flex items-start gap-2 rounded-xl border border-border bg-card p-3"
        >
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">{notice}</p>
          <button
            type="button"
            aria-label="Скрыть сообщение"
            onClick={onDismissNotice}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="ps-next-step mb-2">
        {nextId && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2">
            <span className="text-[11px] font-medium text-muted-foreground">Следующий шаг:</span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
              {TASK_META[nextId].title}
            </span>
          </div>
        )}
      </div>
      <div className="ps-task-card flex flex-col" data-testid="task-experience-shell">
        {guidedExperience && !["math", "memory", "stroop", "reaction"].includes(id) && (
          <div className="ps-task-motion mb-2 h-24 shrink-0" data-testid="task-motion-region">
            <Suspense fallback={<div className="h-24 rounded-2xl bg-secondary/40" />}>
              <TaskMotionVisual taskId={id} />
            </Suspense>
          </div>
        )}
        <div className="ps-task-interaction" data-testid="task-interaction-region">
          {preparingSeconds === 0 && (
            <>
              {id === "math" && (
                <MathTask
                  key={`${id}-${taskIndex}`}
                  durationMinutes={durationMinutes}
                  protocolVersion={protocolVersion}
                  onDone={completeTask}
                />
              )}
              {id === "memory" && (
                <MemoryTask
                  key={`${id}-${taskIndex}`}
                  durationMinutes={durationMinutes}
                  protocolVersion={protocolVersion}
                  onDone={completeTask}
                />
              )}
              {id === "stroop" && (
                <StroopTask
                  key={`${id}-${taskIndex}`}
                  durationMinutes={durationMinutes}
                  protocolVersion={protocolVersion}
                  onDone={completeTask}
                />
              )}
              {id === "reaction" && (
                <ReactionTask
                  key={`${id}-${taskIndex}`}
                  durationMinutes={durationMinutes}
                  protocolVersion={protocolVersion}
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
                id === "pushups" ||
                id === "notice_three" ||
                id === "find_color" ||
                id === "breathing") && (
                <Suspense fallback={<div className="rounded-2xl bg-secondary/30" />}>
                  <ConfirmTask
                    key={`${id}-${taskIndex}`}
                    taskId={id}
                    durationMinutes={durationMinutes}
                    protocolVersion={protocolVersion}
                    onRemainingChange={setCurrentStepRemaining}
                    onPauseChange={setTaskPaused}
                    soundMode={soundMode}
                    onDone={completeTask}
                    actionContainer={taskActionContainer}
                    interactionMode={interactionMode}
                    preparing={preparingSeconds > 0}
                    autoStart={preparingSeconds === 0 && !autoResumeBlocked}
                  />
                </Suspense>
              )}
            </>
          )}
        </div>
        {submitting && (
          <div
            className="grid min-h-8 shrink-0 place-items-center pt-1 text-xs text-muted-foreground"
            aria-live="polite"
            data-testid="task-submit-region"
          >
            Подтверждаем шаг на сервере…
          </div>
        )}
      </div>
      <div className="ps-task-action-slot" ref={setTaskActionContainer} />
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────
