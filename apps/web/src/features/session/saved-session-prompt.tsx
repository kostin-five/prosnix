import { primeHandsFreeSpeech } from "../tasks/hands-free-audio.js";
import { enableWakeSoundFromGesture } from "../tasks/task-experience-feedback.js";

export function SavedSessionPrompt({
  sessionKind,
  currentStepIndex,
  stepCount,
  discarding,
  error,
  onContinue,
  onDiscard,
  handsFreeSound = false,
}: {
  sessionKind: "primary" | "recovery";
  currentStepIndex: number;
  stepCount: number;
  discarding: boolean;
  error: string | null;
  onContinue: () => void;
  onDiscard: () => void;
  handsFreeSound?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {sessionKind === "recovery" ? "Дополнительный раунд сохранён" : "Сессия сохранена"}
        </p>
        <h1 className="mt-2 text-2xl font-bold">Продолжить пробуждение?</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Подтверждено шагов: {currentStepIndex} из {stepCount}. Мы продолжим с последней
          сохранённой точки. Если закончить сейчас, основной результат останется сохранён.
        </p>
        <button
          disabled={discarding}
          onClick={() => {
            if (handsFreeSound) {
              void enableWakeSoundFromGesture();
              primeHandsFreeSpeech();
            }
            onContinue();
          }}
          className="mt-6 w-full rounded-2xl bg-primary py-3 font-bold text-white"
        >
          Продолжить
        </button>
        <button
          disabled={discarding}
          onClick={onDiscard}
          className="mt-2 w-full rounded-2xl bg-secondary py-3 font-semibold text-foreground"
        >
          {discarding
            ? "Завершаем…"
            : sessionKind === "recovery"
              ? "Завершить пробуждение"
              : "Закрыть сохранённую сессию"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default SavedSessionPrompt;
