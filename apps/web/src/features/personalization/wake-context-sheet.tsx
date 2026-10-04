import React from "react";
import type { WakeContext, WakeDurationMinutes } from "../../shared/api/client.js";

const CONTEXTS: Array<{ value: WakeContext; title: string; hint: string }> = [
  {
    value: "night_sleep",
    title: "После ночного сна",
    hint: "Обычное утреннее пробуждение",
  },
  { value: "short_nap", title: "После короткого сна", hint: "Дремал до 30 минут" },
  { value: "long_nap", title: "После долгого сна", hint: "Спал больше 30 минут днём" },
  {
    value: "energy_reset",
    title: "Нужно взбодриться",
    hint: "Не спал, но нужна перезагрузка",
  },
];

function ContextIcon({ context }: { context: WakeContext }) {
  const path = {
    night_sleep:
      "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4M8.5 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z",
    short_nap:
      "M12 7v5l3 2M5 4 3 6m16-6 2 6M5 19l-2 2m16-2 2 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
    long_nap: "M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z",
    energy_reset: "M20 7v5h-5M4 17v-5h5m10.7-4A8 8 0 0 0 6.3 6.3L4 8m16 8-2.3 1.7A8 8 0 0 1 4.3 16",
  }[context];
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export function WakeContextSheet({
  defaultDuration,
  profileComplete,
  busy,
  onCancel,
  onOpenProfile,
  onStart,
}: {
  defaultDuration: WakeDurationMinutes;
  profileComplete: boolean;
  busy: boolean;
  onCancel: () => void;
  onOpenProfile: () => void;
  onStart: (
    context: WakeContext,
    duration: WakeDurationMinutes,
    mode: "manual" | "hands_free",
  ) => void;
}) {
  const [context, setContext] = React.useState<WakeContext>("night_sleep");
  const [duration, setDuration] = React.useState<WakeDurationMinutes>(defaultDuration);
  const [mode, setMode] = React.useState<"manual" | "hands_free">("manual");
  return (
    <div className="ps-flow ps-context fixed inset-0 z-50 mx-auto flex h-[100dvh] min-h-0 w-full max-w-[390px] flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-5">
        <button
          onClick={onCancel}
          className="mb-2 flex min-h-10 items-center gap-2 self-start rounded-xl px-2 text-sm text-muted-foreground"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Назад
        </button>
        <p className="ps-kicker mt-3">Контекст пробуждения</p>
        <h1 className="ps-flow-title mt-2">Как ты просыпаешься сейчас?</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Контекст помогает сравнивать похожие ситуации пробуждения. Первые протоколы могут
          совпадать; дальше Prosnix учится отдельно для выбранного контекста и времени.
        </p>
        {!profileComplete && (
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-4">
            <p className="text-sm font-semibold">Сделать задания удобнее?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ответь на четыре коротких вопроса или продолжи с безопасным набором без упражнений.
            </p>
            <button
              onClick={onOpenProfile}
              className="mt-3 min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"
            >
              Настроить возможности
            </button>
          </div>
        )}
        <div className="mt-4 space-y-1.5">
          {CONTEXTS.map((item) => {
            const selected = context === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setContext(item.value)}
                aria-pressed={selected}
                className={`ps-flow-choice flex min-h-14 items-center gap-3 px-4 py-2.5 ${selected ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <span
                  aria-hidden="true"
                  className={selected ? "w-5 text-primary" : "w-5 text-muted-foreground"}
                >
                  <ContextIcon context={item.value} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-sm font-semibold">Какой формат удобнее?</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(
            [
              [2, "Короткий", "≈ 2 мин"],
              [5, "Средний", "≈ 5 мин"],
              [10, "Длинный", "≈ 10 мин"],
            ] as const
          ).map(([value, label, estimate]) => (
            <button
              key={value}
              onClick={() => setDuration(value)}
              aria-pressed={duration === value}
              className={`ps-flow-choice flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-sm font-semibold ${duration === value ? "border-accent bg-accent/15 text-accent" : "border-border bg-card"}`}
            >
              <span>{label}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{estimate}</span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-sm font-semibold">Как пройти протокол?</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["manual", "С экраном", "Подтверждать шаги самому"],
              ["hands_free", "Без телефона", "Голос и переход по таймеру"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={`ps-flow-choice min-h-20 px-3 py-2 text-left ${mode === value ? "border-accent bg-accent/15" : "border-border bg-card"}`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {label}
                {value === "hands_free" && (
                  <span className="rounded-full border border-amber-400/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-300">
                    Бета
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
        {mode === "hands_free" && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            После запуска шаги завершатся по таймеру. Пауза — нажатием на таймер. Звук работает,
            пока Mini App открыт; в конце нужно оценить состояние на экране.
          </p>
        )}
      </div>
      <div className="shrink-0 bg-[#0d0b09] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <button
          disabled={busy}
          onClick={() => onStart(context, duration, mode)}
          className="ps-primary-button w-full px-5 disabled:opacity-60"
        >
          {busy ? "Подбираем протокол…" : "Начать пробуждение"}
        </button>
      </div>
    </div>
  );
}
