import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { acceptLegalDocuments, type LegalStatusResponse } from "../../shared/api/client.js";

export function LegalGate({
  legal,
  onAccepted,
}: {
  legal: LegalStatusResponse;
  onAccepted: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await acceptLegalDocuments({
        privacyVersion: legal.privacyVersion,
        termsVersion: legal.termsVersion,
      });
      onAccepted();
    } catch {
      setError("Документы обновились или сервер временно недоступен. Повтори попытку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 text-foreground">
      <section className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
        <ShieldCheck className="h-9 w-9 text-primary" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
          Prosnix Beta
        </p>
        <h1 className="mt-1 text-2xl font-bold">Сначала — прозрачные правила</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Мы сохраняем Telegram ID, оценки бодрости, выполнение протоколов и ответы через 15 минут,
          чтобы строить личную статистику. Prosnix не является медицинской услугой.
        </p>
        <div className="mt-5 flex gap-4 text-sm font-semibold text-primary">
          <a href="/privacy" target="_blank" rel="noreferrer">
            Политика
          </a>
          <a href="/terms" target="_blank" rel="noreferrer">
            Соглашение
          </a>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-secondary p-4 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 accent-orange-500"
          />
          <span>Я прочитал документы и принимаю их текущие версии.</span>
        </label>
        <button
          disabled={!confirmed || saving}
          onClick={() => void accept()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-white disabled:opacity-40"
        >
          <CheckCircle2 className="h-5 w-5" />
          {saving ? "Сохраняем…" : "Принять и продолжить"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
