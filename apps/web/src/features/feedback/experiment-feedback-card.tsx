import { useState } from "react";

import { useExperimentFeedback } from "./use-experiment-feedback.js";

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
      <p className="text-sm font-semibold">Помоги улучшить эксперимент</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Три коротких ответа. Это не влияет на текущие рекомендации и спрашивается один раз.
      </p>
      {(
        [
          ["helpful", "Насколько формат оказался полезен?"],
          ["irritating", "Насколько он раздражал?"],
          ["continueIntent", "Насколько хочешь продолжать?"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="mt-3 block text-xs font-medium">
          {label}
          <select
            value={values[key]}
            onChange={(event) =>
              setValues((current) => ({ ...current, [key]: Number(event.target.value) }))
            }
            className="mt-1 min-h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm"
          >
            <option value={0}>Выбрать оценку</option>
            <option value={1}>1 — совсем нет</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5 — полностью</option>
          </select>
        </label>
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
