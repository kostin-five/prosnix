import { X } from "lucide-react";
import { TaskIcon, type TaskId } from "./task-icon.js";

export function ProtocolSheet({
  steps,
  currentIndex,
  onClose,
  onAwakened,
  busy = false,
}: {
  steps: Array<{ taskId: TaskId; title: string }>;
  currentIndex: number;
  onClose: () => void;
  onAwakened?: () => void;
  busy?: boolean;
}) {
  return (
    <div
      className="ps-protocol-sheet fixed inset-0 z-50 flex items-end bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Назначенный протокол"
        className="ps-protocol-dialog mx-auto w-full max-w-[358px] rounded-3xl border border-border bg-card p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">Твой протокол</p>
            <p className="text-xs text-muted-foreground">Порядок сохранён для этого пробуждения</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onAwakened && (
              <button
                type="button"
                disabled={busy}
                onClick={onAwakened}
                className="min-h-11 rounded-xl border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary disabled:opacity-50"
              >
                Проснулся
              </button>
            )}
            <button
              type="button"
              aria-label="Закрыть протокол"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <ol className="ps-protocol-list space-y-2">
          {steps.map((step, index) => (
            <li
              key={`${step.taskId}-${index}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${index === currentIndex ? "bg-primary/10 text-primary" : "bg-secondary/60"}`}
              aria-current={index === currentIndex ? "step" : undefined}
            >
              <span className="w-5 text-center text-xs font-bold">{index + 1}</span>
              <TaskIcon taskId={step.taskId} className="h-4 w-4" />
              <span className="text-sm font-medium">{step.title}</span>
              {index < currentIndex && (
                <span className="ml-auto text-xs text-muted-foreground">Готово</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default ProtocolSheet;
