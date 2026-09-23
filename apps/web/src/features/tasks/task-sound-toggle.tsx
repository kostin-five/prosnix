import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import {
  enableWakeSoundFromGesture,
  signalTaskFeedback,
  type WakeSoundMode,
} from "./task-experience-feedback.js";

export function TaskSoundToggle({
  mode,
  onChange,
  compact = false,
}: {
  mode: WakeSoundMode;
  onChange: (mode: WakeSoundMode) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const enable = async () => {
    setBusy(true);
    setUnavailable(false);
    const enabled = await enableWakeSoundFromGesture();
    setBusy(false);
    if (!enabled) {
      onChange("off");
      setUnavailable(true);
      return;
    }
    onChange("on");
    signalTaskFeedback("start", "on");
  };

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          aria-label={mode === "on" ? "Выключить звук" : "Включить звук"}
          aria-pressed={mode === "on"}
          disabled={busy}
          onClick={() => (mode === "on" ? onChange("off") : void enable())}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold"
        >
          {mode === "on" ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {mode === "on" ? "Со звуком" : "Без звука"}
        </button>
        {unavailable && <span className="text-[10px] text-muted-foreground">Звук недоступен</span>}
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Сопровождение протокола</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Режим звука">
        <button
          type="button"
          aria-pressed={mode === "off"}
          onClick={() => onChange("off")}
          className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${mode === "off" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
        >
          <span className="inline-flex items-center gap-2">
            <VolumeX className="h-4 w-4" /> Без звука
          </span>
        </button>
        <button
          type="button"
          aria-pressed={mode === "on"}
          disabled={busy}
          onClick={() => void enable()}
          className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${mode === "on" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
        >
          <span className="inline-flex items-center gap-2">
            <Volume2 className="h-4 w-4" /> {busy ? "Включаем…" : "Со звуком"}
          </span>
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {unavailable
          ? "Telegram или устройство не разрешили звук. Протокол продолжит работать без него."
          : "Звук включится только после твоего нажатия и его можно отключить в любой момент."}
      </p>
    </section>
  );
}

export default TaskSoundToggle;
