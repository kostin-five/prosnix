import { useEffect, useState } from "react";
import { BarChart3, RefreshCcw, ShieldAlert } from "lucide-react";

import { authenticateTelegram } from "../../shared/api/client.js";
import { getLaunchContext } from "../../telegram/bridge.js";

interface Summary {
  computedAt: string;
  users: { total: number; new: number; active: number };
  sessions: { started: number; completed: number; abandoned: number; completionRate: number };
  followUp: { answered: number; up: number; back: number; drowsy: number };
  retention: {
    d1: { eligible: number; retained: number; rate: number };
    d7: { eligible: number; retained: number; rate: number };
  };
  deliveries: { dailySent: number; followUpSent: number; failed: number; blocked: number };
  billing: { enabled: boolean; activeSubscriptions: number; grossStars: number };
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function AdminScreen() {
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        try {
          const launch = getLaunchContext();
          if (launch.mode === "telegram") await authenticateTelegram(launch.initData);
        } catch {
          /* existing secure cookie can still authorize */
        }
        const response = await fetch(`/api/v1/admin/growth?days=${days}`, {
          credentials: "same-origin",
        });
        if (!response.ok)
          throw new Error(
            response.status === 404 ? "Доступ не разрешён" : "Не удалось загрузить метрики",
          );
        const value = (await response.json()) as Summary;
        if (!cancelled) setData(value);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error)
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-xl font-bold">Админ-панель закрыта</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );

  const cards = data
    ? [
        [
          "Пользователи",
          `${data.users.active} активных`,
          `Всего ${data.users.total} · новых ${data.users.new}`,
        ],
        [
          "Завершение",
          percent(data.sessions.completionRate),
          `${data.sessions.completed} из ${data.sessions.started} сессий`,
        ],
        [
          "D1 retention",
          percent(data.retention.d1.rate),
          `${data.retention.d1.retained} из ${data.retention.d1.eligible}`,
        ],
        [
          "D7 retention",
          percent(data.retention.d7.rate),
          `${data.retention.d7.retained} из ${data.retention.d7.eligible}`,
        ],
        [
          "Follow-up",
          `${data.followUp.answered} ответов`,
          `Встал ${data.followUp.up} · лёг ${data.followUp.back} · сонный ${data.followUp.drowsy}`,
        ],
        [
          "Доставка",
          `${data.deliveries.dailySent + data.deliveries.followUpSent} отправлено`,
          `Ошибки ${data.deliveries.failed} · блокировки ${data.deliveries.blocked}`,
        ],
        [
          "Pro",
          `${data.billing.activeSubscriptions} активных`,
          `${data.billing.grossStars} Stars за период`,
        ],
      ]
    : [];

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Prosnix owner
            </p>
            <h1 className="text-2xl font-bold">Продуктовая сводка</h1>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          {([7, 30, 90] as const).map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${days === value ? "bg-primary text-white" : "bg-card"}`}
            >
              {value} дней
            </button>
          ))}
        </div>
        {loading ? (
          <p className="mt-10 flex items-center gap-2 text-muted-foreground">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            Считаем агрегаты…
          </p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {cards.map(([title, value, detail]) => (
              <section key={title} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </section>
            ))}
          </div>
        )}
        {data && (
          <p className="mt-5 text-xs text-muted-foreground">
            Пересчитано {new Date(data.computedAt).toLocaleString("ru-RU")}. Только агрегаты, без
            профилей пользователей.
          </p>
        )}
      </div>
    </main>
  );
}
