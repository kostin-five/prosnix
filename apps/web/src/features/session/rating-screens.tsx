import { lazy, Suspense, useState } from "react";
import { ArrowRight, Sun } from "lucide-react";

import type { WakeSoundMode } from "../tasks/task-experience-feedback.js";

const MorningExperienceSlot = lazy(() => import("../personalization/morning-experience-slot.js"));
const TaskSoundToggle = lazy(() => import("../tasks/task-sound-toggle.js"));

function MoonMark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RatingGrid({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (rating: number) => void;
}) {
  return (
    <div className="mb-3 grid grid-cols-5 gap-2">
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
            className={`aspect-square rounded-2xl border text-xl font-bold transition-all duration-150 ${rating === selected ? `${color} scale-110 border-2 shadow-lg` : "border-border bg-secondary text-foreground active:scale-95"}`}
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
  onSoundModeChange?: (mode: WakeSoundMode) => void;
  goalCalibrationEnabled?: boolean;
  guidedExperience?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="flex flex-1 flex-col justify-center p-6">
      <div className="mb-10 text-center">
        <MoonMark className="mx-auto mb-5 h-12 w-12 text-accent" />
        <h1 className="mb-2 text-2xl font-bold">Перед протоколом</h1>
        <p className="text-muted-foreground">Насколько бодрым ты себя чувствуешь прямо сейчас?</p>
      </div>
      {goalCalibrationEnabled && localStorageScope && (
        <Suspense fallback={null}>
          <MorningExperienceSlot mode="goal" storageScope={localStorageScope} />
        </Suspense>
      )}
      {guidedExperience && (
        <Suspense fallback={<div className="mb-6 h-24 rounded-2xl bg-card" />}>
          <TaskSoundToggle mode={soundMode} onChange={onSoundModeChange} />
        </Suspense>
      )}
      <RatingGrid selected={selected} onSelect={setSelected} />
      <div className="mb-8 flex justify-between px-1 text-xs text-muted-foreground">
        <span>1 — еле проснулся</span>
        <span>10 — полностью бодр</span>
      </div>
      <button
        type="button"
        onClick={() => selected && onDone(selected)}
        disabled={!selected || !ready || busy}
        className={`w-full rounded-2xl py-4 text-lg font-bold transition-all ${selected && ready && !busy ? "text-white active:scale-[0.98]" : "bg-secondary text-muted-foreground"}`}
        style={
          selected && ready && !busy
            ? {
                background: "linear-gradient(135deg,#F97316,#EA580C)",
                boxShadow: "0 8px 32px rgba(249,115,22,.25)",
              }
            : {}
        }
      >
        {!ready ? "Подготавливаем протокол…" : busy ? "Сохраняем…" : "Начать протокол →"}
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
    <div className="flex flex-1 flex-col justify-center p-6">
      <div className="mb-6 text-center">
        <Sun className="mx-auto mb-5 h-12 w-12 text-accent" strokeWidth={1.7} />
        <h1 className="mb-2 text-2xl font-bold">Протокол завершён</h1>
        <p className="text-muted-foreground">А сейчас насколько бодрым ты себя чувствуешь?</p>
      </div>
      <div className="mb-8 flex items-center justify-center gap-4">
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
              <div className="mb-1 text-sm text-muted-foreground">Эффект</div>
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
      <RatingGrid selected={selected} onSelect={setSelected} />
      <div className="mb-8 flex justify-between px-1 text-xs text-muted-foreground">
        <span>1 — еле проснулся</span>
        <span>10 — полностью бодр</span>
      </div>
      <button
        type="button"
        onClick={() => selected && onDone(selected)}
        disabled={!selected}
        className={`w-full rounded-2xl py-4 text-lg font-bold transition-all ${selected ? "text-white active:scale-[0.98]" : "bg-secondary text-muted-foreground"}`}
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
