import { useEffect, useState } from "react";
import { Crown } from "lucide-react";

import { openTelegramInvoice } from "../../telegram/bridge.js";

interface BillingStatus {
  enabled: boolean;
  plan: { key: string; priceStars: number | null; periodDays: number };
  entitlement: { status: string; currentPeriodEnd: string | null };
}

export function ProCard() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const response = await fetch("/api/v1/billing/status", { credentials: "same-origin" });
    if (response.ok) setStatus((await response.json()) as BillingStatus);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Не удалось создать безопасный счёт");
      const body = (await response.json()) as { invoiceUrl: string };
      await openTelegramInvoice(body.invoiceUrl);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Оплата временно недоступна");
    } finally {
      setBusy(false);
    }
  }

  const entitled =
    status?.entitlement.currentPeriodEnd !== null &&
    ["active", "canceled", "past_due"].includes(status?.entitlement.status ?? "") &&
    new Date(status!.entitlement.currentPeriodEnd!).getTime() > Date.now();
  return (
    <section className="ps-surface mb-4 border-primary/30 p-4">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Prosnix Pro</p>
      </div>
      {entitled ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Доступ активен до{" "}
          {new Date(status!.entitlement.currentPeriodEnd!).toLocaleDateString("ru-RU")}.
          {status!.entitlement.status === "canceled"
            ? " Автопродление отключено."
            : status!.entitlement.status === "past_due"
              ? " Последнее продление не прошло."
              : " Автопродление включено."}
        </p>
      ) : status?.enabled ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Расширенная история и будущие Pro-возможности. {status.plan.priceStars} Stars за 30 дней
            с автопродлением.
          </p>
          <button
            disabled={busy}
            onClick={() => void checkout()}
            className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Открываем Telegram…" : `Попробовать Pro за ${status.plan.priceStars} Stars`}
          </button>
        </>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Платная версия ещё не включена. Все основные функции MVP остаются бесплатными.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
