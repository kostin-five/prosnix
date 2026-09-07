import { useState } from "react";

import { useExperimentFeedback } from "./use-experiment-feedback.js";

const questions = [
  {
    key: "helpful",
    label: "Насколько формат оказался полезен?",
    low: "Совсем не помог",
    high: "Очень полезен",
  },
  {
    key: "irritating",
    label: "Насколько формат раздражал?",
    low: "Совсем не раздражал",
    high: "Очень раздражал",
  },
  {
    key: "continueIntent",
    label: "Хочешь продолжать эксперимент?",
    low: "Скорее нет",
    high: "Да, точно",
  },
] as const;

export function ExperimentFeedbackCard({ refreshKey }: { refreshKey: number }) {
  const feedback = useExperimentFeedback(true, refreshKey);
  const [values, setValues] = useState({ helpful: 0, irritating: 0, continueIntent: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (Object.values(values).some((value) => value < 1 || value > 5)) return;
    setSaving(true);
    setError(null);
    try {
      await feedback.submit(values);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Не удалось сохранить ответ",
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    feedback.state.status !== "ready" ||
    !feedback.state.feedback.eligible ||
    feedback.state.feedback.submitted
  ) {
    return null;
  }

  return (
    <section className="mb-5 rounded-2xl border border-accent/25 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Помоги улучшить эксперимент</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Три быстрых ответа. Они не влияют на текущий протокол и спросятся только один раз.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent">
          {Object.values(values).filter(Boolean).length}/3
        </span>
      </div>
      {questions.map(({ key, label, low, high }) => (
        <fieldset key={key} className="mt-4">
          <legend className="text-xs font-semibold">{label}</legend>
          <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={label}>
            {[1, 2, 3, 4, 5].map((value) => {
              const selected = values[key] === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${label}: ${value}`}
                  onClick={() => setValues((current) => ({ ...current, [key]: value }))}
                  className={`min-h-11 rounded-xl border text-sm font-bold transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between gap-3 text-[11px] text-muted-foreground">
            <span>{low}</span>
            <span className="text-right">{high}</span>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={saving || Object.values(values).some((value) => value === 0)}
        onClick={() => void submit()}
        className="mt-4 min-h-11 w-full rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Сохраняем…" : "Отправить ответы"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
