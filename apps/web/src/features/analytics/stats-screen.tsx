import { lazy, Suspense, useState } from "react";
import { Activity, ArrowRight, Check, ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import { eligibleWakeTasks } from "@awc/domain";
import type { WakeContext, WakeProfile, WakeRoutine } from "../../shared/api/client.js";
import type { FollowUp, Session, TaskCategory, TaskId } from "../../app/App.js";
import { TaskIcon } from "../tasks/task-icon.js";
import { useAnalyticsProfile } from "./use-analytics.js";
import { useCoachInsight } from "../coach/use-coach-insight.js";
import { useSessionHistory } from "../history/use-session-history.js";

const StatsResearchCards = lazy(() => import("../research/stats-research-cards.js"));
const WakeProfileSummary = lazy(() => import("./wake-profile-summary.js"));
const WakeRoutineChecklist = lazy(async () => ({
  default: (await import("../personalization/wake-routine-card.js")).WakeRoutineChecklist,
}));

type Confidence = "insufficient" | "low" | "medium" | "high";
type TaskMetaMap = Record<TaskId, { category: TaskCategory; title: string; subtitle: string }>;
type CategoryEffectiveness = Record<
  TaskCategory,
  { avgDelta: number; avgAlertness: number; sessions: number; backRate: number }
>;

function CategoryIcon({
  category,
  className = "h-4 w-4",
}: {
  category: TaskCategory;
  className?: string;
}) {
  const taskId: Record<TaskCategory, TaskId> = {
    cognitive: "memory",
    movement: "steps",
    behavioral: "water",
    environment: "window",
  };
  return <TaskIcon taskId={taskId[category]} className={className} />;
}

function getConfidence(n: number): Confidence {
  if (n < 2) return "insufficient";
  if (n < 3) return "low";
  if (n < 6) return "medium";
  return "high";
}

const CONF_LABEL: Record<Confidence, string> = {
  insufficient: "Недостаточно данных",
  low: "Низкая уверенность",
  medium: "Средняя уверенность",
  high: "Высокая уверенность",
};

function taskMeta(taskId: string, meta: TaskMetaMap) {
  return taskId in meta ? meta[taskId as TaskId] : null;
}

function taskCountLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} задание`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return `${count} задания`;
  }
  return `${count} заданий`;
}

function durationLabel(durationMs: number | null): string {
  if (durationMs === null) return "Время не зафиксировано";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} сек`;
  return seconds === 0 ? `${minutes} мин` : `${minutes} мин ${seconds} сек`;
}

function wakeContextLabel(context: WakeContext | "unspecified"): string {
  if (context === "night_sleep") return "После ночного сна";
  if (context === "short_nap") return "После короткого сна";
  if (context === "long_nap") return "После долгого дневного сна";
  if (context === "energy_reset") return "Перезагрузка без сна";
  return "Контекст не указан";
}

function followUpLabel(followUp: FollowUp): string {
  if (followUp === "up") return "Через 15 минут: встал";
  if (followUp === "back") return "Через 15 минут: лёг обратно";
  if (followUp === "drowsy") return "Через 15 минут: ещё сонный";
  return "Проверка через 15 минут не пройдена";
}

function catEffLabel(avgDelta: number, sessions: number): { text: string; color: string } {
  const conf = getConfidence(sessions);
  if (conf === "insufficient")
    return { text: "Недостаточно данных", color: "text-muted-foreground" };
  if (avgDelta >= 5) return { text: "Помогает сильнее всего", color: "text-green-400" };
  if (avgDelta >= 3) return { text: "Хороший эффект", color: "text-green-400" };
  if (avgDelta >= 1) return { text: "Умеренный эффект", color: "text-yellow-400" };
  return { text: "Пока слабый эффект", color: "text-muted-foreground" };
}

// ─── Stats Screen ─────────────────────────────────────────────────────────────
export default function StatsScreen({
  sessions,
  demo,
  routine,
  profile,
  taskMetaMap,
  categoryMeta,
  computeCategoryEffectiveness,
  computeNextPlan,
}: {
  sessions: Session[];
  demo: boolean;
  routine: WakeRoutine;
  profile: WakeProfile;
  taskMetaMap: TaskMetaMap;
  categoryMeta: Record<TaskCategory, { label: string; color: string; bg: string }>;
  computeCategoryEffectiveness: (sessions: Session[]) => CategoryEffectiveness;
  computeNextPlan: (sessions: Session[]) => {
    taskIds: TaskId[];
    rationale: string;
    isLearning: boolean;
  };
}) {
  const analytics = useAnalyticsProfile(!demo, sessions.length);
  const { state: coach, requestInsight } = useCoachInsight(!demo);
  const history = useSessionHistory(!demo, sessions.length);
  const [openHistoryIds, setOpenHistoryIds] = useState<Set<string>>(() => new Set());
  const [showAllHistory, setShowAllHistory] = useState(false);
  const apiProfile = analytics.status === "ready" ? analytics.profile : null;
  const valid = sessions.filter((s) => s.endAlertness > 0);
  const evidenceCount = demo ? valid.length : (apiProfile?.averageDelta.evidenceCount ?? 0);
  const progressKnown = demo || analytics.status === "ready";
  const isLearning = progressKnown && evidenceCount < 7;

  // Key metrics
  const avgGain = demo
    ? valid.length
      ? valid.reduce((s, v) => s + (v.endAlertness - v.startAlertness), 0) / valid.length
      : 0
    : (apiProfile?.averageDelta.value ?? 0);
  const followedUp = valid.filter((s) => s.followUp !== null);
  const successRate = demo
    ? followedUp.length
      ? Math.round((followedUp.filter((s) => s.followUp === "up").length / followedUp.length) * 100)
      : null
    : apiProfile?.riseSuccess.value === null || apiProfile?.riseSuccess.value === undefined
      ? null
      : Math.round(apiProfile.riseSuccess.value * 100);
  const serverDurations =
    history.status === "ready"
      ? history.items
          .filter((item) => item.sessionKind !== "recovery")
          .map((item) => item.durationMs)
          .filter((duration): duration is number => duration !== null)
      : [];
  const avgMinutes = demo
    ? valid.length
      ? Math.round(
          (valid.reduce((sum, item) => sum + item.totalMs, 0) / valid.length / 60000) * 10,
        ) / 10
      : null
    : serverDurations.length
      ? Math.round(
          (serverDurations.reduce((sum, duration) => sum + duration, 0) /
            serverDurations.length /
            60000) *
            10,
        ) / 10
      : null;

  // Category profile
  const eff = computeCategoryEffectiveness(demo ? valid : []);
  const sortedCats = (Object.entries(eff) as [TaskCategory, (typeof eff)[TaskCategory]][])
    .filter(([, d]) => d.sessions > 0)
    .sort((a, b) => b[1].avgDelta - a[1].avgDelta);

  // Best sequence
  const sequenceCandidates =
    apiProfile?.sequenceEffects.filter((metric) => metric.value !== null) ?? [];
  const verifiedSequenceCandidates = sequenceCandidates.filter(
    ({ evidenceCount: count }) => count >= 2,
  );
  const bestSequence = (
    verifiedSequenceCandidates.length ? verifiedSequenceCandidates : sequenceCandidates
  ).sort(
    (left, right) =>
      (right.value ?? 0) - (left.value ?? 0) || right.evidenceCount - left.evidenceCount,
  )[0];
  const bestSequenceTasks = bestSequence
    ? bestSequence.key
        .replace(/^sequence:/, "")
        .split("|", 1)[0]!
        .split(">")
        .filter((taskId): taskId is TaskId => taskId in taskMetaMap)
    : [];
  const permittedTasks = new Set(
    eligibleWakeTasks(
      {
        ...profile,
        excludedTaskIds: profile.excludedTaskIds.filter(
          (taskId): taskId is TaskId => taskId in taskMetaMap,
        ),
      },
      {
        v9Enabled: import.meta.env.VITE_WAKE_TASK_CATALOG_V9_ENABLED === "true",
      },
    ),
  );
  permittedTasks.add("sit_edge");
  const comparableSequenceTasks = bestSequenceTasks.every((taskId) => permittedTasks.has(taskId))
    ? bestSequenceTasks
    : [];

  // Next plan
  const nextPlan = computeNextPlan(sessions);
  const nextExperimentTasks = demo
    ? nextPlan.taskIds.filter((taskId) => permittedTasks.has(taskId))
    : !progressKnown || isLearning
      ? []
      : comparableSequenceTasks;
  const nextExperimentText = demo
    ? nextPlan.rationale
    : !progressKnown
      ? analytics.status === "error"
        ? "Статистика временно недоступна. Следующее пробуждение можно пройти как обычно."
        : "Проверяем сохранённые пробуждения и готовим следующий шаг…"
      : evidenceCount === 0
        ? "После следующего сна выбери короткий протокол: оцени бодрость до и после, затем ответь через 15 минут."
        : isLearning
          ? `В следующий раз выбери тот же контекст сна и формат времени, пройди назначенные шаги и ответь через 15 минут. До первого профиля осталось ${7 - evidenceCount}.`
          : bestSequence && comparableSequenceTasks.length > 0
            ? `Проверь порядок «${comparableSequenceTasks.map((taskId) => taskMetaMap[taskId].title).join(" → ")}» после похожего сна и с тем же запасом времени. Он наблюдался в ${bestSequence.evidenceCount} сопоставимых сессиях.`
            : "В следующий раз выбери тот же контекст сна и формат времени, пройди назначенный протокол и ответь через 15 минут. Так появится сопоставимое наблюдение.";

  return (
    <div className="ps-stats flex flex-1 flex-col overflow-y-auto px-5 pb-28 pt-8">
      <header className="ps-stats-header mb-6">
        <div className="mb-7 flex items-center justify-between gap-2">
          <div>
            <p className="ps-wordmark">
              Prosni<span>x</span>
            </p>
            <p className="ps-kicker mt-2">Больше, чем просто утро</p>
          </div>
          <span className="ps-stats-count rounded-full px-3 py-2 text-xs">
            {progressKnown ? `Завершено: ${evidenceCount}` : "Обновляем данные"}
          </span>
        </div>
        <h1 className="ps-flow-title">Статистика</h1>
        <p className="mt-2 text-base text-muted-foreground">Твои пробуждения. Твои наблюдения.</p>
      </header>

      <section
        className="ps-surface ps-stats-hero mb-4 p-5"
        aria-label="Среднее изменение бодрости"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>Среднее изменение</span>
        </div>
        <div className="ps-stats-hero-value mt-3">
          {progressKnown && evidenceCount > 0
            ? `${avgGain >= 0 ? "+" : ""}${avgGain.toFixed(1)}`
            : "—"}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {progressKnown
            ? evidenceCount > 0
              ? `По ${evidenceCount} пробуждениям · пункты шкалы 1–10`
              : "Появится после первого завершённого пробуждения"
            : "Подсчитываем среднее изменение…"}
        </p>
      </section>

      <section className="ps-surface ps-stats-next mb-4 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Следующий шаг</h2>
          </div>
        </div>
        {isLearning && (
          <div className="mb-4">
            <div
              className="ps-stats-progress mb-2"
              role="progressbar"
              aria-label="Прогресс до первого профиля"
              aria-valuenow={evidenceCount}
              aria-valuemin={0}
              aria-valuemax={7}
            >
              <span style={{ width: `${Math.min(100, (evidenceCount / 7) * 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {evidenceCount} из 7 до первого общего профиля
            </p>
          </div>
        )}
        {nextExperimentTasks.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {nextExperimentTasks.map((taskId, index, all) => (
              <div key={`${taskId}-${index}`} className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-xs font-medium">
                  <TaskIcon taskId={taskId} className="h-3.5 w-3.5 text-primary" />
                  {taskMetaMap[taskId].title}
                </span>
                {index < all.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        )}
        <p className="text-sm leading-relaxed" aria-live="polite">
          {nextExperimentText}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Это рабочая проверка, а не доказанный лучший способ. Сравнение станет полезнее после
          повторов в похожих условиях.
        </p>
      </section>

      {!demo && (
        <section className="ps-surface ps-stats-report mb-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Персональный отчёт</h2>
          </div>
          {analytics.status !== "ready" ? (
            <p className="text-sm text-muted-foreground">
              {analytics.status === "error"
                ? "Не удалось проверить число завершённых пробуждений. Попробуй позже."
                : "Проверяем, достаточно ли данных для отчёта…"}
            </p>
          ) : evidenceCount < 3 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Пока мало данных для персонального отчёта: {evidenceCount}/3 завершённых пробуждений.
              До отчёта осталось {3 - evidenceCount}.
            </p>
          ) : coach.status === "idle" ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Отчёт объяснит устойчивость результата и изменения между пробуждениями. Доступен
                один новый бесплатный отчёт в день.
              </p>
              <button
                type="button"
                onClick={() => void requestInsight()}
                className="ps-primary-button mt-4 w-full"
              >
                Создать персональный отчёт
              </button>
            </>
          ) : coach.status === "loading" ? (
            <p className="text-sm text-muted-foreground">Ищем закономерности в твоих данных…</p>
          ) : coach.status === "error" ? (
            <p className="text-sm text-muted-foreground">{coach.message}</p>
          ) : coach.status === "ready" ? (
            coach.insight.insight ? (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {coach.insight.source === "provider"
                    ? "AI-разбор"
                    : coach.insight.source === "cache"
                      ? "Сохранённый разбор"
                      : "Разбор по данным"}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                  Главный вывод
                </p>
                <p className="mt-1 text-sm leading-relaxed">{coach.insight.insight.summary}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-accent">
                  Что проверить в следующий раз
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {coach.insight.insight.nextExperiment}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {coach.insight.insight.caveat.replace(
                    /^Базовый отчёт основан на \d+ сессиях?\.\s*/,
                    "",
                  )}
                </p>
                {coach.insight.limitReached && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Следующее обновление доступно после{" "}
                    {new Date(coach.insight.refreshAvailableAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Отчёт пока недоступен.</p>
            )
          ) : null}
        </section>
      )}

      <div className="ps-stats-metrics mb-4 grid grid-cols-2 gap-3">
        <div className="ps-surface p-4">
          <Check className="w-4 h-4 text-green-400 mx-auto mb-2" />
          <div className="text-xl font-extrabold">
            {successRate !== null ? `${successRate}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Подъём</div>
        </div>
        <div className="ps-surface p-4">
          <Activity className="w-4 h-4 text-accent mx-auto mb-2" />
          <div className="text-xl font-extrabold">
            {avgMinutes !== null ? `${avgMinutes}м` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Время</div>
        </div>
      </div>

      {/* Wake-up profile */}
      <section className="ps-surface ps-stats-profile mb-5 p-5">
        <h2 className="mb-4 text-base font-semibold">Твой профиль пробуждения</h2>
        {!demo && analytics.status === "loading" ? (
          <p className="text-sm text-muted-foreground">
            Пересчитываем профиль по сохранённым сессиям…
          </p>
        ) : !demo && analytics.status === "error" ? (
          <p className="text-sm text-red-400">{analytics.message}</p>
        ) : !demo && apiProfile && (evidenceCount >= 7 || apiProfile.factorEffects.length > 0) ? (
          <Suspense fallback={<p className="text-sm text-muted-foreground">Готовим профиль…</p>}>
            <WakeProfileSummary
              profile={apiProfile}
              evidenceCount={evidenceCount}
              recentSessions={
                history.status === "ready"
                  ? history.items.filter((item) => item.sessionKind !== "recovery")
                  : []
              }
            />
          </Suspense>
        ) : sortedCats.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {evidenceCount >= 7
              ? `Профиль готов по ${evidenceCount} завершённым сессиям. Сравнение отдельных факторов появится после трёх пар наблюдений.`
              : `Сохранено ${evidenceCount} завершённых сессий. Первый общий профиль появится после 7.`}
          </p>
        ) : (
          sortedCats.map(([cat, data]) => {
            const catMeta = categoryMeta[cat];
            const conf = getConfidence(data.sessions);
            const eff2 = catEffLabel(data.avgDelta, data.sessions);
            const showNum = conf !== "insufficient" && conf !== "low";
            return (
              <div
                key={cat}
                className="flex items-start justify-between py-3 border-b border-border last:border-0"
              >
                <div className="flex items-start gap-3 flex-1">
                  <CategoryIcon category={cat} className={`mt-0.5 h-5 w-5 ${catMeta.color}`} />
                  <div>
                    <p className="text-sm font-semibold">{catMeta.label}</p>
                    <p className={`text-sm ${eff2.color}`}>{eff2.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CONF_LABEL[conf]} · {data.sessions}{" "}
                      {data.sessions === 1
                        ? "эксперимент"
                        : data.sessions < 5
                          ? "эксперимента"
                          : "экспериментов"}
                    </p>
                  </div>
                </div>
                {showNum && (
                  <div className="text-right">
                    <span
                      className={`text-lg font-black ${data.avgDelta >= 3 ? "text-green-400" : "text-yellow-400"}`}
                    >
                      +{data.avgDelta.toFixed(1)}
                    </span>
                    <p className="text-xs text-muted-foreground">к бодрости</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {!demo && (
        <Suspense fallback={null}>
          <StatsResearchCards refreshKey={sessions.length} />
        </Suspense>
      )}

      <section className="ps-stats-history">
        <h2 className="mb-1 text-xl font-bold">История пробуждений</h2>
        <p className="mb-3 text-sm text-muted-foreground">Здесь все завершённые сессии.</p>
        <div className="ps-surface p-4">
          {demo &&
            [...valid]
              .reverse()
              .slice(0, 6)
              .map((s, i) => {
                const delta = s.endAlertness - s.startAlertness;
                const deltaColor2 =
                  delta >= 4 ? "text-green-400" : delta >= 2 ? "text-yellow-300" : "text-red-400";
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {s.date} · {s.wakeTime}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {s.tasks.map((t) => (
                          <span key={t.id} className="text-base">
                            <TaskIcon taskId={t.id} className="h-4 w-4 text-primary" />
                          </span>
                        ))}
                        {s.followUp === "back" && (
                          <span className="text-xs text-red-400 ml-1">лёг обратно</span>
                        )}
                        {s.followUp === "up" && (
                          <span className="text-xs text-green-400 ml-1">встал</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-lg font-black ${deltaColor2}`}>
                        {delta >= 0 ? "+" : ""}
                        {delta}
                        <span className="text-xs text-muted-foreground font-normal"> балла</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
          {!demo && history.status === "loading" && (
            <p className="text-sm text-muted-foreground">Загружаем сохранённые сессии…</p>
          )}
          {!demo && history.status === "error" && (
            <p className="text-sm text-red-400">{history.message}</p>
          )}
          {!demo &&
            history.status === "ready" &&
            (showAllHistory ? history.items : history.items.slice(0, 5)).map((item, index) => {
              const delta = item.postRating - item.baseline;
              const deltaColor =
                delta >= 4 ? "text-green-400" : delta >= 2 ? "text-yellow-300" : "text-red-400";
              return (
                <details
                  key={item.id}
                  onToggle={(event) => {
                    const open = event.currentTarget.open;
                    setOpenHistoryIds((current) => {
                      const next = new Set(current);
                      if (open) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    });
                  }}
                  className="group border-b border-border last:border-0"
                >
                  <summary
                    aria-label={`Открыть эксперимент ${index + 1}`}
                    className="flex cursor-pointer list-none items-center justify-between py-3 [&::-webkit-details-marker]:hidden"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(item.completedAt).toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {item.sessionKind === "recovery" && (
                        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                          Дополнительный раунд
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.baseline} → {item.postRating} · {taskCountLabel(item.tasks.length)}
                        {item.followUp === "up"
                          ? " · встал"
                          : item.followUp === "back"
                            ? " · лёг обратно"
                            : item.followUp === "drowsy"
                              ? " · ещё сонный"
                              : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-lg font-black ${deltaColor}`}>
                        {delta >= 0 ? "+" : ""}
                        {delta}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="mb-3 rounded-xl bg-secondary/60 p-3">
                    <p className="text-xs font-semibold">Что было в эксперименте</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {item.tasks.map((task, taskIndex) => {
                        const meta = taskMeta(task.taskId, taskMetaMap);
                        return (
                          <div
                            key={`${task.taskId}-${taskIndex}`}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-card">
                              {meta ? (
                                <TaskIcon taskId={task.taskId as TaskId} className="h-3.5 w-3.5" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </span>
                            <span>
                              {taskIndex + 1}. {meta?.title ?? "Задание"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                      <p>
                        Бодрость: {item.baseline} → {item.postRating}
                      </p>
                      <p>Длительность: {durationLabel(item.durationMs)}</p>
                      <p>Контекст: {wakeContextLabel(item.wakeContext)}</p>
                      <p>Выбранный режим: {item.durationMinutes} мин</p>
                      <p className="col-span-2">{followUpLabel(item.followUp)}</p>
                    </div>
                    {openHistoryIds.has(item.id) && (
                      <div className="mt-3">
                        <Suspense fallback={null}>
                          <WakeRoutineChecklist
                            sessionId={item.id}
                            routine={routine}
                            demo={false}
                          />
                        </Suspense>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          {!demo && history.status === "ready" && history.items.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllHistory((current) => !current)}
              className="mt-3 min-h-11 w-full rounded-xl bg-secondary px-3 text-sm font-semibold"
            >
              {showAllHistory ? "Скрыть ранние сессии" : `Показать ещё ${history.items.length - 5}`}
            </button>
          )}
          {((demo && valid.length === 0) ||
            (!demo && history.status === "ready" && history.items.length === 0)) && (
            <p className="text-sm text-muted-foreground">Ещё нет завершённых сессий.</p>
          )}
        </div>
      </section>
    </div>
  );
}
