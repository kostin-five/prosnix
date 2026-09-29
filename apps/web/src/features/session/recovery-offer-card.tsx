export function RecoveryOfferCard({
  busy,
  onStart,
  onDecline,
}: {
  busy: boolean;
  onStart: () => void;
  onDecline: () => void;
}) {
  return (
    <section className="ps-recovery-offer mb-5 rounded-2xl border border-primary/35 bg-primary/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Необязательное продолжение
      </p>
      <h2 className="mt-1 text-lg font-bold">Ещё до 90 секунд</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Изменение пока небольшое. Можно проверить один короткий раунд из одного–двух других
        действий. Основной результат уже сохранён и не изменится.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onStart}
        className="mt-4 min-h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Готовим раунд…" : "Пройти короткий раунд"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDecline}
        className="mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-muted-foreground disabled:opacity-60"
      >
        Завершить пробуждение
      </button>
    </section>
  );
}

export default RecoveryOfferCard;
