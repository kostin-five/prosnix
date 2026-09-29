import { RefreshCw, ShieldAlert, ThumbsDown } from "lucide-react";

export type TaskSubstitutionReason = "unwilling_now" | "not_helpful" | "cannot_do";

const REASONS: Array<{
  value: TaskSubstitutionReason;
  title: string;
  description: string;
  icon: typeof RefreshCw;
}> = [
  {
    value: "unwilling_now",
    title: "Не хочу сейчас",
    description: "Только для этого пробуждения",
    icon: RefreshCw,
  },
  {
    value: "not_helpful",
    title: "Кажется, не помогает",
    description: "Сохраним как личный сигнал, не как доказанный вывод",
    icon: ThumbsDown,
  },
  {
    value: "cannot_do",
    title: "Не могу выполнить",
    description: "После замены отдельно предложим обновить будущие ограничения",
    icon: ShieldAlert,
  },
];

export function TaskSubstitutionSheet({
  taskTitle,
  busy,
  onSelect,
  onClose,
}: {
  taskTitle: string;
  busy: boolean;
  onSelect: (reason: TaskSubstitutionReason) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="ps-substitution-sheet fixed inset-0 z-[70] flex items-end bg-black/65 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Заменить задание ${taskTitle}`}
        className="ps-substitution-dialog mx-auto w-full max-w-[358px] rounded-3xl border border-border bg-card p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Замена шага</p>
        <h2 className="mt-1 text-xl font-bold">Почему заменить «{taskTitle}»?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Подберём новое безопасное действие и сохраним фактический порядок эксперимента.
        </p>
        <div className="mt-5 space-y-2">
          {REASONS.map(({ value, title, description, icon: Icon }) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => onSelect(value)}
              className="flex w-full items-start gap-3 rounded-2xl border border-border bg-secondary/55 px-4 py-3 text-left disabled:opacity-50"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {description}
                </span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="mt-4 min-h-11 w-full rounded-xl text-sm font-semibold text-muted-foreground"
        >
          Оставить текущее задание
        </button>
      </div>
    </div>
  );
}

export default TaskSubstitutionSheet;
