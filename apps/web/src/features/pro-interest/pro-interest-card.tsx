import { useState } from "react";

import { useProInterest } from "./use-pro-interest.js";

type Intent = "interested" | "not_now" | "not_interested";
type Focus = "long_history" | "deeper_experiments" | "both";

const intentOptions: ReadonlyArray<{ value: Intent; label: string }> = [
  { value: "interested", label: "Интересно" },
  { value: "not_now", label: "Пока не нужно" },
  { value: "not_interested", label: "Неинтересно" },
];

const focusOptions: ReadonlyArray<{ value: Focus; label: string }> = [
  { value: "long_history", label: "Длинная история" },
  { value: "deeper_experiments", label: "Глубокие эксперименты" },
  { value: "both", label: "Оба направления" },
];

export function ProInterestCard({ refreshKey }: { refreshKey: number }) {
  const interest = useProInterest(true, refreshKey);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!intent || (intent === "interested" && !focus)) return;
    setSaving(true);
    setError(null);
    try {
      await interest.submit(
        intent === "interested" ? { intent, interestFocus: focus! } : { intent },
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Не удалось сохранить ответ",
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    interest.state.status !== "ready" ||
    !interest.state.interest.eligible ||
    interest.state.interest.submitted
  ) {
    return null;
  }

  return (
    <section className="mb-5 rounded-2xl border border-accent/25 bg-card p-4">
      <p className="text-sm font-semibold">Помоги выбрать, что развивать дальше</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Проверяем интерес к будущему расширенному режиму. Это не подписка: цены, оплаты и списания
        сейчас нет.
      </p>
      <fieldset className="mt-4">
        <legend className="text-xs font-semibold">Был бы тебе полезен такой режим?</legend>
        <div
          className="mt-2 grid gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Интерес к Pro"
        >
          {intentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={intent === option.value}
              onClick={() => {
                setIntent(option.value);
                if (option.value !== "interested") setFocus(null);
              }}
              className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                intent === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
      {intent === "interested" && (
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold">Что было бы ценнее?</legend>
          <div
            className="mt-2 grid gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Ценность Pro"
          >
            {focusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={focus === option.value}
                onClick={() => setFocus(option.value)}
                className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                  focus === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <button
        type="button"
        disabled={saving || !intent || (intent === "interested" && !focus)}
        onClick={() => void submit()}
        className="mt-4 min-h-11 w-full rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Сохраняем…" : "Оставить ответ"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
