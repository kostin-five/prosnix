import { AlertTriangle, Bell, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { WakeSchedule } from "./schedule-api.js";

function nextLabel(value: string | null, timezone: string): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function WakeScheduleCard({
  schedule,
  defaultTime,
  saving,
  onSave,
}: {
  schedule: WakeSchedule | null;
  defaultTime: string;
  saving: boolean;
  onSave: (input: { localTime: string; timezone: string; enabled: boolean }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [localTime, setLocalTime] = useState(schedule?.localTime ?? defaultTime);
  const [enabled, setEnabled] = useState(schedule?.enabled ?? false);
  const timezone = schedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

  useEffect(() => {
    if (!schedule) return;
    setLocalTime(schedule.localTime);
    setEnabled(schedule.enabled);
  }, [schedule]);

  async function save() {
    try {
      await onSave({ localTime, timezone, enabled });
      setEditing(false);
    } catch {
      // Родитель показывает безопасную ошибку синхронизации; оставляем форму открытой.
    }
  }

  const next = schedule?.enabled ? nextLabel(schedule.nextTriggerAt, schedule.timezone) : null;

  return (
    <section
      aria-labelledby="wake-reminder-title"
      className="bg-card border border-border rounded-3xl p-5 mb-4 relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle at 80% 50%, #F97316 0%, transparent 60%)" }}
      />
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Bell className="w-4 h-4" />
          <span id="wake-reminder-title">Telegram-напоминание</span>
        </div>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="text-xs border border-border rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
        >
          {editing ? "Отмена" : "Изменить"}
        </button>
      </div>

      {editing ? (
        <div className="relative space-y-4">
          <label className="block">
            <span className="sr-only">Время пробуждения</span>
            <input
              aria-label="Время пробуждения"
              type="time"
              value={localTime}
              onChange={(event) => setLocalTime(event.target.value)}
              className="text-5xl font-extrabold bg-transparent border-none outline-none text-foreground w-full"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 p-3">
            <span className="text-sm font-medium">Присылать каждый день</span>
            <input
              aria-label="Включить Telegram-напоминание"
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Сохраняем…
              </span>
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="text-6xl font-extrabold tracking-tight">
            {schedule?.localTime ?? defaultTime}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            {schedule?.botStatus === "blocked" ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-red-300">Бот не может писать. Открой чат и нажми Start.</span>
              </>
            ) : schedule?.enabled && schedule.botStatus === "unknown" ? (
              <>
                <Bell className="h-4 w-4 text-amber-300" />
                <span>Ещё не проверено{next ? ` · Следующее: ${next}` : ""}</span>
              </>
            ) : schedule?.enabled ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span>{next ? `Следующее: ${next}` : "Напоминание включено"}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Напоминание выключено</span>
            )}
          </div>
        </div>
      )}

      <p className="relative mt-4 text-xs leading-relaxed text-muted-foreground">
        Это сообщение в Telegram, а не системный будильник. Звук зависит от уведомлений телефона,
        режима «Не беспокоить» и сети.
      </p>
    </section>
  );
}
