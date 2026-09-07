import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCcw, ShieldAlert } from "lucide-react";

import { authenticateTelegram } from "../../shared/api/client.js";
import { getLaunchContext } from "../../telegram/bridge.js";

type GrowthPeriodDays = 7 | 30 | 90;

export interface AdminGrowthData {
  period: { days: GrowthPeriodDays; from: string; to: string };
  computedAt: string;
  users: { total: number; new: number; active: number };
  sessions: { started: number; completed: number; abandoned: number; completionRate: number };
  funnel: {
    assigned: number;
    started: number;
    completed: number;
    followedUp: number;
    startRate: number;
    completionRate: number;
    followUpRate: number;
  };
  wakeQuality: {
    pairedSessions: number;
    averageDelta: number | null;
    improvedSessions: number;
    improvedRate: number;
  };
  followUp: {
    eligible: number;
    answered: number;
    responseRate: number;
    up: number;
    back: number;
    drowsy: number;
    stayedUpRate: number;
  };
  retention: {
    d1: { eligible: number; retained: number; rate: number };
    d7: { eligible: number; retained: number; rate: number };
  };
  timeline: Array<{
    date: string;
    newUsers: number;
    startedSessions: number;
    completedSessions: number;
  }>;
  breakdowns: {
    contexts: Array<{
      key: "unspecified" | "night_sleep" | "short_nap" | "long_nap" | "energy_reset";
      sessions: number;
      completed: number;
      completionRate: number;
    }>;
    durations: Array<{
      minutes: 2 | 5 | 10;
      sessions: number;
      completed: number;
      completionRate: number;
    }>;
    proInterest: {
      responses: number;
      interested: number;
      notNow: number;
      notInterested: number;
      longHistory: number;
      deeperExperiments: number;
      both: number;
    };
  };
  features: {
    capabilityProfiles: number;
    routinesEnabled: number;
    routineRuns: number;
    routineRunsCompleted: number;
    aiInsightsGenerated: number;
  };
  deliveries: {
    dailySent: number;
    followUpSent: number;
    failed: number;
    blocked: number;
    terminal: number;
    successRate: number;
  };
  billing: { enabled: boolean; activeSubscriptions: number; grossStars: number };
}

const PERIODS: readonly GrowthPeriodDays[] = [7, 30, 90];
const CONTEXT_LABELS: Record<AdminGrowthData["breakdowns"]["contexts"][number]["key"], string> = {
  unspecified: "Не указан",
  night_sleep: "Ночной сон",
  short_nap: "Короткий дневной сон",
  long_nap: "Долгий дневной сон",
  energy_reset: "Восстановление без сна",
};

const percent = (value: number) => `${Math.round(value * 100)}%`;
const count = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
const signed = (value: number | null) =>
  value === null ? "Нет данных" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
const emptyProInterest = {
  responses: 0,
  interested: 0,
  notNow: 0,
  notInterested: 0,
  longHistory: 0,
  deeperExperiments: 0,
  both: 0,
};

function MetricCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </article>
  );
}

function ProgressRow({
  label,
  value,
  total,
  rate,
}: {
  label: string;
  value: number;
  total: number;
  rate: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="shrink-0 text-muted-foreground">
          {count(value)} · {percent(rate)}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.max(total, 1)}
        aria-valuenow={value}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, rate * 100))}%` }}
        />
      </div>
    </div>
  );
}

function BreakdownRows({
  rows,
}: {
  rows: Array<{ label: string; sessions: number; completed: number; completionRate: number }>;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">За период данных пока нет.</p>;
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <ProgressRow
          key={row.label}
          label={row.label}
          value={row.completed}
          total={row.sessions}
          rate={row.completionRate}
        />
      ))}
    </div>
  );
}

export function AdminScreen() {
  const [days, setDays] = useState<GrowthPeriodDays>(7);
  const [data, setData] = useState<AdminGrowthData | null>(null);
  const [error, setError] = useState<{
    message: string;
    denied: boolean;
    requestId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestVersion, setRequestVersion] = useState(0);

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
          /* An existing secure cookie can still authorize the owner. */
        }
        const response = await fetch(`/api/v1/admin/growth?days=${days}`, {
          credentials: "same-origin",
        });
        if (!response.ok) {
          const denied = response.status === 404;
          const body = (await response.json().catch(() => null)) as {
            requestId?: unknown;
          } | null;
          const requestId =
            typeof body?.requestId === "string" && body.requestId.length <= 128
              ? body.requestId
              : undefined;
          throw Object.assign(
            new Error(denied ? "Доступ не разрешён" : "Не удалось загрузить метрики"),
            { denied, requestId },
          );
        }
        const value = (await response.json()) as AdminGrowthData;
        if (!cancelled) setData(value);
      } catch (reason) {
        if (!cancelled) {
          setData(null);
          setError({
            message: reason instanceof Error ? reason.message : "Ошибка загрузки",
            denied: Boolean(
              reason && typeof reason === "object" && "denied" in reason && reason.denied,
            ),
            ...(reason &&
            typeof reason === "object" &&
            "requestId" in reason &&
            typeof reason.requestId === "string"
              ? { requestId: reason.requestId }
              : {}),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days, requestVersion]);

  const maxTimelineValue = useMemo(
    () =>
      Math.max(
        1,
        ...(data?.timeline.map((item) =>
          Math.max(item.newUsers, item.startedSessions, item.completedSessions),
        ) ?? []),
      ),
    [data],
  );

  if (error)
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold">
            {error.denied ? "Админ-панель закрыта" : "Не удалось загрузить панель"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
          {error.requestId && (
            <p className="mt-2 break-all text-xs text-muted-foreground">
              Код запроса: {error.requestId}
            </p>
          )}
          {!error.denied && (
            <button
              type="button"
              className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              onClick={() => setRequestVersion((value) => value + 1)}
            >
              Повторить
            </button>
          )}
        </div>
      </main>
    );

  const empty = Boolean(data && data.funnel.assigned === 0 && data.users.new === 0);
  const proInterest = data?.breakdowns.proInterest ?? emptyProInterest;

  return (
    <main className="min-h-screen bg-background px-4 py-7 text-foreground sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Prosnix owner
            </p>
            <h1 className="text-2xl font-bold">Продуктовая аналитика</h1>
          </div>
        </header>

        <nav className="mt-6 flex gap-2" aria-label="Период аналитики">
          {PERIODS.map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setDays(value)}
              aria-pressed={days === value}
              className={`min-w-0 flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold sm:flex-none sm:px-5 ${days === value ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {value} дней
            </button>
          ))}
        </nav>

        {loading ? (
          <p className="mt-10 flex items-center gap-2 text-muted-foreground" role="status">
            <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
            Считаем агрегаты…
          </p>
        ) : data ? (
          <div className="mt-6 space-y-5">
            {empty && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-bold">За этот период пока нет активности</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Попробуйте выбрать больший период. Нулевые значения ниже сохранены для контроля.
                </p>
              </section>
            )}

            <section aria-labelledby="overview-title">
              <h2 id="overview-title" className="mb-3 text-lg font-bold">
                Обзор
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Активные пользователи"
                  value={count(data.users.active)}
                  detail={`Новых ${count(data.users.new)} · всего ${count(data.users.total)}`}
                />
                <MetricCard
                  title="Средний прирост"
                  value={signed(data.wakeQuality.averageDelta)}
                  detail={`${count(data.wakeQuality.pairedSessions)} парных сессий; это наблюдение, не доказанная причина`}
                />
                <MetricCard
                  title="Остались бодрствовать"
                  value={percent(data.followUp.stayedUpRate)}
                  detail={`${count(data.followUp.up)} из ${count(data.followUp.answered)} ответов follow-up`}
                />
                <MetricCard
                  title="Успешность доставки"
                  value={percent(data.deliveries.successRate)}
                  detail={`${count(data.deliveries.dailySent + data.deliveries.followUpSent)} из ${count(data.deliveries.terminal)} конечных попыток`}
                />
              </div>
            </section>

            <section
              className="rounded-2xl border border-border bg-card p-4 sm:p-5"
              aria-labelledby="funnel-title"
            >
              <h2 id="funnel-title" className="text-lg font-bold">
                Воронка пробуждения
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Одна когорта сессий, созданных за период. Каждый процент считается от предыдущего
                подходящего этапа.
              </p>
              <div className="mt-5 space-y-5">
                <ProgressRow
                  label="Начали протокол"
                  value={data.funnel.started}
                  total={data.funnel.assigned}
                  rate={data.funnel.startRate}
                />
                <ProgressRow
                  label="Завершили протокол"
                  value={data.funnel.completed}
                  total={data.funnel.started}
                  rate={data.funnel.completionRate}
                />
                <ProgressRow
                  label="Ответили через 15 минут"
                  value={data.funnel.followedUp}
                  total={data.funnel.completed}
                  rate={data.funnel.followUpRate}
                />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Назначено {count(data.funnel.assigned)} · брошено {count(data.sessions.abandoned)}
              </p>
            </section>

            <section aria-labelledby="quality-title">
              <h2 id="quality-title" className="mb-3 text-lg font-bold">
                Качество пробуждения
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Улучшили оценку"
                  value={percent(data.wakeQuality.improvedRate)}
                  detail={`${count(data.wakeQuality.improvedSessions)} из ${count(data.wakeQuality.pairedSessions)} парных сессий`}
                />
                <MetricCard
                  title="Ответили на follow-up"
                  value={percent(data.followUp.responseRate)}
                  detail={`${count(data.followUp.answered)} из ${count(data.followUp.eligible)} завершённых сессий`}
                />
                <MetricCard
                  title="Легли обратно"
                  value={count(data.followUp.back)}
                  detail={`Сонные ${count(data.followUp.drowsy)} · встали ${count(data.followUp.up)}`}
                />
                <MetricCard
                  title="Размер выборки"
                  value={count(data.wakeQuality.pairedSessions)}
                  detail={
                    data.wakeQuality.pairedSessions < 10
                      ? "Малая выборка: выводы пока предварительные"
                      : "Достаточно для наблюдения динамики, но не причинного вывода"
                  }
                />
              </div>
            </section>

            <section
              className="rounded-2xl border border-border bg-card p-4 sm:p-5"
              aria-labelledby="timeline-title"
            >
              <h2 id="timeline-title" className="text-lg font-bold">
                Динамика
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                24-часовые UTC-интервалы: новые пользователи, старты и завершения.
              </p>
              <div className="mt-5 space-y-3">
                {data.timeline.map((point) => (
                  <div key={point.date} className="grid grid-cols-[5.2rem_1fr] items-center gap-3">
                    <span className="text-xs text-muted-foreground">{point.date.slice(5)}</span>
                    <div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="bg-sky-400"
                          style={{ width: `${(point.newUsers / maxTimelineValue) * 33.33}%` }}
                          title={`Новых: ${point.newUsers}`}
                        />
                        <div
                          className="bg-amber-400"
                          style={{
                            width: `${(point.startedSessions / maxTimelineValue) * 33.33}%`,
                          }}
                          title={`Стартов: ${point.startedSessions}`}
                        />
                        <div
                          className="bg-primary"
                          style={{
                            width: `${(point.completedSessions / maxTimelineValue) * 33.33}%`,
                          }}
                          title={`Завершений: ${point.completedSessions}`}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        +{point.newUsers} пользователей · {point.startedSessions} стартов ·{" "}
                        {point.completedSessions} завершений
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Синий — новые</span>
                <span>Жёлтый — старты</span>
                <span>Оранжевый — завершения</span>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section
                className="rounded-2xl border border-border bg-card p-4 sm:p-5"
                aria-labelledby="contexts-title"
              >
                <h2 id="contexts-title" className="mb-4 text-lg font-bold">
                  Контексты пробуждения
                </h2>
                <BreakdownRows
                  rows={data.breakdowns.contexts.map((item) => ({
                    label: CONTEXT_LABELS[item.key],
                    sessions: item.sessions,
                    completed: item.completed,
                    completionRate: item.completionRate,
                  }))}
                />
              </section>
              <section
                className="rounded-2xl border border-border bg-card p-4 sm:p-5"
                aria-labelledby="durations-title"
              >
                <h2 id="durations-title" className="mb-4 text-lg font-bold">
                  Длительность протокола
                </h2>
                <BreakdownRows
                  rows={data.breakdowns.durations.map((item) => ({
                    label: `${item.minutes} минут`,
                    sessions: item.sessions,
                    completed: item.completed,
                    completionRate: item.completionRate,
                  }))}
                />
              </section>
            </div>

            <section aria-labelledby="retention-title">
              <h2 id="retention-title" className="mb-3 text-lg font-bold">
                Удержание и функции
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="D1 retention"
                  value={percent(data.retention.d1.rate)}
                  detail={`${count(data.retention.d1.retained)} из ${count(data.retention.d1.eligible)} подходящих пользователей`}
                />
                <MetricCard
                  title="D7 retention"
                  value={percent(data.retention.d7.rate)}
                  detail={`${count(data.retention.d7.retained)} из ${count(data.retention.d7.eligible)} подходящих пользователей`}
                />
                <MetricCard
                  title="Завершили анкету"
                  value={count(data.features.capabilityProfiles)}
                  detail={`Новых включённых рутин: ${count(data.features.routinesEnabled)}`}
                />
                <MetricCard
                  title="Использование функций"
                  value={`${count(data.features.aiInsightsGenerated)} AI`}
                  detail={`Рутин за период ${count(data.features.routineRuns)} · завершено ${count(data.features.routineRunsCompleted)}`}
                />
              </div>
            </section>

            <section aria-labelledby="pro-interest-title">
              <h2 id="pro-interest-title" className="mb-3 text-lg font-bold">
                Интерес к будущему Pro
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Ответили на исследование"
                  value={count(proInterest.responses)}
                  detail="Это не платёж и не конверсия в подписку"
                />
                <MetricCard
                  title="Интересно"
                  value={count(proInterest.interested)}
                  detail={`Пока не нужно: ${count(proInterest.notNow)} · неинтересно: ${count(proInterest.notInterested)}`}
                />
                <MetricCard
                  title="Длинная история"
                  value={count(proInterest.longHistory)}
                  detail="Выбрали как будущую ценность"
                />
                <MetricCard
                  title="Глубокие эксперименты"
                  value={count(proInterest.deeperExperiments)}
                  detail={`Оба направления: ${count(proInterest.both)}`}
                />
              </div>
            </section>

            <section aria-labelledby="operations-title">
              <h2 id="operations-title" className="mb-3 text-lg font-bold">
                Эксплуатация
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Wake-напоминания"
                  value={count(data.deliveries.dailySent)}
                  detail="Успешно отправлены за период"
                />
                <MetricCard
                  title="Follow-up напоминания"
                  value={count(data.deliveries.followUpSent)}
                  detail="Успешно отправлены за период"
                />
                <MetricCard
                  title="Ошибки доставки"
                  value={count(data.deliveries.failed + data.deliveries.blocked)}
                  detail={`Ошибки ${count(data.deliveries.failed)} · бот заблокирован ${count(data.deliveries.blocked)}`}
                />
                <MetricCard
                  title="Подписки"
                  value={count(data.billing.activeSubscriptions)}
                  detail={
                    data.billing.enabled
                      ? `${count(data.billing.grossStars)} Stars за период`
                      : "Монетизация пока выключена"
                  }
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Здесь показаны только сохранённые ошибки Telegram-доставки. Ошибки API и runtime
                проверяются в privacy-safe логах Render.
              </p>
            </section>

            <footer className="pb-4 text-xs leading-relaxed text-muted-foreground">
              Пересчитано {new Date(data.computedAt).toLocaleString("ru-RU")}. Только агрегаты без
              персональных записей. Период: {new Date(data.period.from).toLocaleString("ru-RU")} —{" "}
              {new Date(data.period.to).toLocaleString("ru-RU")}.
            </footer>
          </div>
        ) : null}
      </div>
    </main>
  );
}
