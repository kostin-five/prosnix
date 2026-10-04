import { ProsnixWordmark } from "../brand/prosnix-brand.js";
import { useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

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
    <main className="ps-legal flex min-h-screen items-center justify-center p-5 text-foreground">
      <section className="w-full max-w-sm">
        <ProsnixWordmark className="mb-12" />
        <div className="ps-surface p-6">
          <ShieldCheck className="h-10 w-10 text-amber-400" aria-hidden="true" />
          <p className="ps-kicker mt-6">Перед началом</p>
          <h1 className="ps-flow-title mt-2">Сначала — прозрачные правила</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Мы сохраняем Telegram ID, оценки бодрости, выполнение протоколов и ответы через 15
            минут, чтобы строить личную статистику. Prosnix не является медицинской услугой.
          </p>
          <div className="mt-6 flex gap-4 text-sm font-semibold text-amber-300">
            <a href="/privacy" className="underline underline-offset-4">
              Политика
            </a>
            <a href="/terms" className="underline underline-offset-4">
              Соглашение
            </a>
          </div>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
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
            className="ps-primary-button mt-5 flex w-full items-center justify-center gap-2 disabled:opacity-40"
          >
            <CheckCircle2 className="h-5 w-5" />
            {saving ? "Сохраняем…" : "Принять и продолжить"}
            {!saving && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
