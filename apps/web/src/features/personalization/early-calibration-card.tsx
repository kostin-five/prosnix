import { Clock3, Settings2 } from "lucide-react";

export function EarlyCalibrationCard({
  mode,
  sessionNumber,
  onReview,
  onDismiss,
}: {
  mode: "scheduled" | "due";
  sessionNumber: number;
  onReview: () => void;
  onDismiss?: () => void;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-accent/25 bg-accent/8 p-4">
      <div className="flex items-center gap-2">
        {mode === "scheduled" ? (
          <Clock3 className="h-4 w-4 text-accent" aria-hidden="true" />
        ) : (
          <Settings2 className="h-4 w-4 text-accent" aria-hidden="true" />
        )}
        <p className="text-sm font-semibold">
          {mode === "scheduled" ? "Вечером проверь настройки" : "Настроим следующее пробуждение?"}
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {mode === "scheduled"
          ? `Это ${sessionNumber}-е из трёх первых пробуждений. После 18:00 карточка появится в приложении — дополнительного утреннего уведомления не будет.`
          : "Можно уточнить время напоминания, длительность, допустимую нагрузку и личную цель."}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onReview}
          className="min-h-11 flex-1 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-foreground"
        >
          Проверить настройки
        </button>
        {mode === "due" && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 rounded-xl bg-secondary px-3 text-sm font-semibold"
          >
            Не сегодня
          </button>
        )}
      </div>
    </section>
  );
}

export default EarlyCalibrationCard;
