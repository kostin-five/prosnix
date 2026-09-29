import { lazy, Suspense, useEffect, useState } from "react";
import { Activity, ArrowRight, ChevronRight, Flag, Sun } from "lucide-react";

import { useAnalyticsProfile } from "../analytics/use-analytics.js";
import { useSessionHistory } from "../history/use-session-history.js";
import { ProductBetaBadge } from "../brand/prosnix-brand.js";
import { loadLifeGoal } from "../personalization/personalization-api.js";
import { readMorningGoal } from "../personalization/morning-preferences.js";

const GOAL_CALIBRATION_ENABLED = import.meta.env.VITE_GOAL_CALIBRATION_ENABLED !== "false";
const MorningExperienceSlot = lazy(() => import("../personalization/morning-experience-slot.js"));

type HomeSession = { startAlertness: number; endAlertness: number };

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({
  onStart,
  sessions,
  demo,
  localStorageScope,
  onOpenSettings,
  onOpenGoal,
}: {
  onStart: () => void;
  sessions: HomeSession[];
  demo: boolean;
  localStorageScope: string;
  onOpenSettings: () => void;
  onOpenGoal: () => void;
}) {
  const analytics = useAnalyticsProfile(!demo, sessions.length);
  const history = useSessionHistory(!demo, sessions.length);
  const [lifeGoal, setLifeGoal] = useState<{
    status: "loading" | "ready" | "error";
    text: string;
  }>({ status: "loading", text: "" });
  useEffect(() => {
    if (demo) {
      setLifeGoal({ status: "ready", text: readMorningGoal(localStorageScope) });
      return;
    }
    let active = true;
    void loadLifeGoal()
      .then(({ text }) => {
        if (active) setLifeGoal({ status: "ready", text });
      })
      .catch(() => {
        if (active) setLifeGoal({ status: "error", text: "" });
      });
    return () => {
      active = false;
    };
  }, [demo, localStorageScope]);
  const valid = sessions.filter((s) => s.endAlertness > 0);
  const serverItems = history.status === "ready" ? history.items : [];
  const apiProfile = analytics.status === "ready" ? analytics.profile : null;
  const countKnown = demo || analytics.status === "ready" || history.status === "ready";
  const experimentCount = demo
    ? valid.length
    : (apiProfile?.averageDelta.evidenceCount ?? serverItems.length);
  const averageValue = demo
    ? valid.length
      ? valid.reduce((sum, item) => sum + item.endAlertness - item.startAlertness, 0) / valid.length
      : null
    : (apiProfile?.averageDelta.value ?? null);
  const avgGain = averageValue === null ? "—" : averageValue.toFixed(1);
  const isLearning = experimentCount < 7;
  const lp = Math.min(experimentCount, 7);

  return (
    <div className="ps-home flex flex-1 flex-col overflow-y-auto px-5 pb-28 pt-8">
      <header className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="ps-wordmark" aria-label="Prosnix">
            Prosni<span>x</span>
          </span>
          <ProductBetaBadge className="mt-1" />
        </div>
        <div
          className="shrink-0 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs"
          aria-label={
            countKnown ? `Завершено сессий: ${experimentCount}` : "Загружаем число сессий"
          }
        >
          {countKnown ? `${experimentCount} сессий` : "…"}
        </div>
      </header>
      <p className="ps-kicker mt-2">Больше, чем просто утро</p>

      <section className="relative mt-12 mb-7" aria-labelledby="home-wake-title">
        <div className="ps-home-orbit" aria-hidden="true" />
        <p className="ps-kicker max-w-40 leading-relaxed">Твой день начинается здесь</p>
        <h1 id="home-wake-title" className="ps-home-heading relative z-10 mt-5">
          Пора проснуться
        </h1>
        <p className="relative z-10 mt-4 max-w-72 text-lg text-muted-foreground">
          Начни с того, что важно тебе
        </p>
      </section>

      {GOAL_CALIBRATION_ENABLED && (
        <button type="button" onClick={onOpenGoal} className="ps-surface mb-5 w-full p-4 text-left">
          <span className="flex items-center gap-2 text-sm text-amber-300">
            <Flag className="h-4 w-4" /> Твоя цель
          </span>
          <span className="mt-3 flex items-center justify-between gap-3 text-lg font-bold leading-snug">
            <span>
              {lifeGoal.status === "loading"
                ? "Загружаем цель…"
                : lifeGoal.status === "error"
                  ? "Цель временно недоступна"
                  : lifeGoal.text || "Добавить цель в жизни"}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </span>
          <span className="mt-2 block text-xs text-muted-foreground">
            {lifeGoal.text
              ? "Можно изменить в настройках"
              : "Необязательно · можно настроить позже"}
          </span>
        </button>
      )}

      <button
        onClick={onStart}
        className="ps-primary-button flex w-full items-center justify-center gap-3 px-3 text-base"
      >
        <Sun className="h-5 w-5 shrink-0" />
        <span>{demo ? "Попробовать пробуждение" : "Начать пробуждение"}</span>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">Понадобится от 2 минут</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="ps-surface min-w-0 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-4 w-4 text-amber-400" /> Пробуждений
          </div>
          <p className="ps-home-metric-value mt-4">{countKnown ? experimentCount : "—"}</p>
          <p className="mt-2 text-xs text-muted-foreground">Твой личный опыт</p>
        </div>
        <div className="ps-surface min-w-0 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Flag className="h-4 w-4 text-amber-400" /> До первого профиля
          </div>
          <p className="ps-home-metric-value mt-4">
            {countKnown ? (isLearning ? 7 - lp : "✓") : "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {countKnown && !isLearning ? "Профиль готов" : "Завершённых пробуждений"}
          </p>
        </div>
      </div>

      <section className="ps-surface mt-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {countKnown
              ? isLearning
                ? "Изучаем твоё пробуждение"
                : "Первый профиль готов"
              : "Загружаем прогресс"}
          </p>
          {countKnown && <span className="text-xs text-amber-300">{lp} из 7</span>}
        </div>
        {countKnown && isLearning && (
          <div className="mt-3 flex gap-1.5" aria-label={`${lp} из 7 до первого профиля`}>
            {Array.from({ length: 7 }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-full ${index < lp ? "bg-amber-400" : "bg-secondary"}`}
              />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {countKnown
            ? `Среднее изменение бодрости: ${avgGain === "—" ? "пока нет данных" : `${(averageValue ?? 0) >= 0 ? "+" : ""}${avgGain} по ${experimentCount} пробуждениям`}. Наблюдения не доказывают причину изменений.`
            : "Получаем подтверждённые данные с сервера."}
        </p>
      </section>

      {GOAL_CALIBRATION_ENABLED && (
        <Suspense fallback={null}>
          <MorningExperienceSlot
            mode="due"
            storageScope={localStorageScope}
            onOpenSettings={onOpenSettings}
          />
        </Suspense>
      )}
    </div>
  );
}
