import { ProsnixWordmark } from "../brand/prosnix-brand.js";
import { lazy, Suspense, useState } from "react";
import { ArrowRight, Sun } from "lucide-react";

import {
  enableWakeSoundFromGesture,
  type WakeSoundMode,
} from "../tasks/task-experience-feedback.js";
import { primeHandsFreeSpeech } from "../tasks/hands-free-audio.js";

const MorningExperienceSlot = lazy(() => import("../personalization/morning-experience-slot.js"));
const TaskSoundToggle = lazy(() => import("../tasks/task-sound-toggle.js"));

function RatingGrid({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (rating: number) => void;
}) {
  return (
    <div className="ps-rating-grid mb-3 grid grid-cols-5 gap-2">
      {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => {
        const color =
          rating <= 3
            ? "text-red-400 bg-red-500/15 border-red-500/40"
            : rating <= 6
              ? "text-yellow-300 bg-yellow-500/15 border-yellow-500/40"
              : "text-green-400 bg-green-500/15 border-green-500/40";
        return (
          <button
            key={rating}
            type="button"
            onClick={() => onSelect(rating)}
            aria-pressed={rating === selected}
            className={`aspect-square rounded-2xl border text-xl font-bold transition-all duration-150 ${rating === selected ? `${color} border-2 shadow-lg` : "border-border bg-secondary text-foreground active:scale-95"}`}
          >
            {rating}
          </button>
        );
      })}
    </div>
  );
}

export function StartRatingScreen({
  onDone,
  ready = true,
  busy = false,
  onRetry,
  localStorageScope,
  soundMode = "off",
  interactionMode = "manual",
  plannedSeconds,
  onSoundModeChange = () => undefined,
  goalCalibrationEnabled = true,
  guidedExperience = true,
}: {
  onDone: (rating: number) => void;
  ready?: boolean;
  busy?: boolean;
  onRetry?: () => void;
  localStorageScope?: string;
  soundMode?: WakeSoundMode;
  interactionMode?: "manual" | "hands_free";
  plannedSeconds?: number;
  onSoundModeChange?: (mode: WakeSoundMode) => void;
  goalCalibrationEnabled?: boolean;
  guidedExperience?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [goalReady, setGoalReady] = useState(!goalCalibrationEnabled || !localStorageScope);
  return (
    <div className="ps-protocol ps-rating-screen flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-7">
      <ProsnixWordmark className="ps-brand-compact mb-4" />
      <div className="ps-rating-heading mb-7">
        <p className="ps-eyebrow mb-3">Перед началом</p>
        <h1 className="ps-flow-title mb-3">Насколько ты бодр сейчас?</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Оцени своё состояние до протокола. Здесь нет правильного ответа.
        </p>
      </div>
      {goalCalibrationEnabled && localStorageScope && (
        <Suspense fallback={null}>
          <MorningExperienceSlot
            mode="goal"
            storageScope={localStorageScope}
            onLoaded={setGoalReady}
          />
        </Suspense>
      )}
      {guidedExperience && (
        <Suspense fallback={<div className="mb-6 h-24 rounded-2xl bg-card" />}>
          <TaskSoundToggle
            mode={soundMode}
            onChange={onSoundModeChange}
            handsFree={interactionMode === "hands_free"}
          />
        </Suspense>
      )}
      {interactionMode === "hands_free" && (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm">
          <p className="font-semibold text-primary">
            Без телефона · ≈ {Math.max(1, Math.round((plannedSeconds ?? 120) / 60))} мин
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            После запуска слушай подсказки и положи телефон рядом. В конце понадобится оценить
            состояние на экране.
          </p>
        </div>
      )}
      <div className="ps-rating-panel">
        <RatingGrid selected={selected} onSelect={setSelected} />
        <div className="mb-8 flex justify-between px-1 text-xs text-muted-foreground">
          <span>1 — еле проснулся</span>
          <span>10 — полностью бодр</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          if (soundMode === "on") void enableWakeSoundFromGesture();
          if (interactionMode === "hands_free" && soundMode === "on") primeHandsFreeSpeech();
          if (selected) onDone(selected);
        }}
        disabled={!selected || !ready || !goalReady || busy}
        className={`ps-primary-button ps-rating-action mt-auto w-full rounded-2xl py-4 text-lg font-bold transition-all ${selected && ready && !busy ? "text-white active:scale-[0.98]" : "bg-secondary text-muted-foreground"}`}
        style={
          selected && ready && goalReady && !busy
            ? {
                background: "linear-gradient(135deg,#F97316,#EA580C)",
                boxShadow: "0 8px 32px rgba(249,115,22,.25)",
              }
            : {}
        }
      >
        {!ready
          ? "Подготавливаем протокол…"
          : !goalReady
            ? "Загружаем цель…"
            : busy
              ? "Сохраняем…"
              : "Начать протокол →"}
      </button>
      {!ready && !busy && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 w-full rounded-2xl border border-border py-3 text-sm font-semibold"
        >
          Повторить подключение
        </button>
      )}
    </div>
  );
}

export function EndRatingScreen({
  startAlertness,
  onDone,
}: {
  startAlertness: number;
  onDone: (rating: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="ps-protocol ps-rating-screen flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-7">
      <ProsnixWordmark className="ps-brand-compact mb-4" />
      <div className="ps-rating-heading mb-6">
        <p className="ps-eyebrow mb-3">
          <Sun className="inline h-4 w-4" /> После протокола
        </p>
        <h1 className="ps-flow-title mb-3">Как ты чувствуешь себя сейчас?</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Оцени бодрость ещё раз — мы сравним две оценки.
        </p>
      </div>
      <div className="ps-rating-comparison mb-7 flex items-center justify-center gap-4">
        <div className="text-center">
          <div className="mb-1 text-sm text-muted-foreground">Было</div>
          <div className="text-3xl font-black text-muted-foreground">
            {startAlertness}
            <span className="text-base">/10</span>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <div className="text-center">
          <div className="mb-1 text-sm text-muted-foreground">Стало</div>
          <div
            className={`text-3xl font-black ${selected ? (selected > startAlertness ? "text-green-400" : "text-yellow-400") : "text-muted-foreground"}`}
          >
            {selected ? `${selected}/10` : "?/10"}
          </div>
        </div>
        {selected && (
          <>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="mb-1 text-sm text-muted-foreground">Изменение</div>
              <div
                className={`text-3xl font-black ${selected - startAlertness > 0 ? "text-green-400" : "text-red-400"}`}
              >
                {selected - startAlertness > 0 ? "+" : ""}
                {selected - startAlertness}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="ps-rating-panel">
        <RatingGrid selected={selected} onSelect={setSelected} />
        <div className="mb-8 flex justify-between px-1 text-xs text-muted-foreground">
          <span>1 — еле проснулся</span>
          <span>10 — полностью бодр</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => selected && onDone(selected)}
        disabled={!selected}
        className={`ps-primary-button ps-rating-action mt-auto w-full rounded-2xl py-4 text-lg font-bold transition-all ${selected ? "text-white active:scale-[0.98]" : "bg-secondary text-muted-foreground"}`}
        style={
          selected
            ? {
                background: "linear-gradient(135deg,#F97316,#EA580C)",
                boxShadow: "0 8px 32px rgba(249,115,22,.25)",
              }
            : {}
        }
      >
        Сохранить результат
      </button>
    </div>
  );
}
