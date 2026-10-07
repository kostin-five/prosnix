import { useDialogFocus } from "../../shared/use-dialog-focus.js";

export function ProfileExclusionDialog({
  title,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useDialogFocus(() => {
    if (!busy) onClose();
  });
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/65 p-4">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Обновить будущие ограничения"
        className="mx-auto w-full max-w-[358px] rounded-3xl border border-border bg-card p-5 shadow-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Будущие пробуждения
        </p>
        <h2 className="mt-1 text-xl font-bold">Больше не предлагать «{title}»?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Текущая замена уже сохранена. Ограничение профиля изменится только после отдельного
          подтверждения.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-12 rounded-xl border border-border bg-secondary text-sm font-semibold"
          >
            Только сейчас
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-12 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            Исключить
          </button>
        </div>
      </div>
    </div>
  );
}
