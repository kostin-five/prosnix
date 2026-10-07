import { ArrowRight, BarChart2, Check, Sparkles } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import { useAnalyticsProfile } from "../features/analytics/use-analytics.js";
import { TaskIcon } from "../features/tasks/task-icon.js";
import type { WakeRoutine } from "../shared/api/client.js";

const GOAL_CALIBRATION_ENABLED = import.meta.env.VITE_GOAL_CALIBRATION_ENABLED !== "false";
const WakeRoutineChecklist = lazy(async () => ({
  default: (await import("../features/personalization/wake-routine-card.js")).WakeRoutineChecklist,
}));

import { CAT_META, FollowUpIcon, TASK_META, type FollowUp, type Session } from "./session-model.js";

export function ResultsScreen({
  session,
  allSessions,
  onStats,
  onHome,
  onSettings,
  onFollowUp,
  onStartRecovery,
  onDeclineRecovery,
  recoveryBusy,
  localStorageScope,
  routine,
  demo,
}: {
  session: Session;
  allSessions: Session[];
  onStats: () => void;
  onHome: () => void;
  onSettings: () => void;
  onFollowUp: (answer: Exclude<FollowUp, null>) => Promise<void>;
  onStartRecovery: () => Promise<void>;
  onDeclineRecovery: () => Promise<void>;
  recoveryBusy: boolean;
  localStorageScope: string;
  routine: WakeRoutine;
  demo: boolean;
}) {
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpAns, setFollowUpAns] = useState<FollowUp>(null);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const analytics = useAnalyticsProfile(!demo, allSessions.length);

  async function answerFollowUp(answer: Exclude<FollowUp, null>) {
    setFollowUpSaving(true);
    setFollowUpError(null);
    try {
      await onFollowUp(answer);
      setFollowUpAns(answer);
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : "Ответ пока не сохранён");
    } finally {
      setFollowUpSaving(false);
    }
  }

  const delta = session.endAlertness - session.startAlertness;
  const deltaColor =
    delta >= 4
      ? "text-green-400"
      : delta >= 2
        ? "text-yellow-400"
        : delta >= 0
          ? "text-orange-400"
          : "text-red-400";
  const validSessions = allSessions.filter((s) => s.endAlertness > 0 && !s.completedEarly);
  const evidenceCount = demo
    ? validSessions.length
    : analytics.status === "ready"
      ? analytics.profile.averageDelta.evidenceCount
      : null;
  const remaining = evidenceCount === null ? null : Math.max(0, 7 - evidenceCount);

  // Build insight
  let insightTitle = "Сессия сохранена";
  let insightBody = "";
  let insightColor = "border-border bg-secondary/30";
  let insightIcon: "saved" | "experiment" | "profile" = "saved";

  if (remaining === null) {
    insightBody =
      analytics.status === "error"
        ? "Сессия сохранена. Профиль обновится, когда аналитика снова будет доступна."
        : "Сессия сохранена. Обновляем профиль по всем завершённым пробуждениям…";
  } else if (remaining > 3) {
    insightBody = `Мы пока собираем данные. Ещё ${remaining} пробуждений помогут определить первые закономерности.`;
  } else if (remaining > 0) {
    insightTitle = "Почти готово";
    insightBody = `Ещё ${remaining} эксперимент${remaining === 1 ? "" : "а"} до первых персональных выводов.`;
    insightColor = "border-accent/20 bg-accent/8";
    insightIcon = "experiment";
  } else {
    insightTitle = "Профиль обновлён";
    insightBody = `Учтено ${evidenceCount} завершённых сессий. Рекомендации и лучший порядок заданий пересчитаны.`;
    insightColor = "border-primary/20 bg-primary/8";
    insightIcon = "profile";
  }

  return (
    <div className="ps-protocol ps-results flex flex-col flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="ps-results-heading text-center pt-8 mb-8">
        <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
          <Check className="w-8 h-8 text-green-400" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold mb-1">
          {session.completedEarly
            ? "Пробуждение завершено досрочно"
            : session.sessionKind === "recovery"
              ? "Дополнительный раунд завершён"
              : "Протокол завершён"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {session.completedEarly && (
        <p className="mb-4 text-sm text-muted-foreground">
          Ты отметил, что уже проснулся. Сохранены только выполненные задания; этот результат не
          участвует в сравнении полных протоколов.
        </p>
      )}
      {/* Before / After / Effect — main result */}
      <div className="ps-results-scores bg-card border border-border rounded-3xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-2">До</p>
            <p className="text-4xl font-black text-muted-foreground">
              {session.startAlertness}
              <span className="text-lg font-semibold">/10</span>
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-2">После</p>
            <p className="text-4xl font-black text-foreground">
              {session.endAlertness}
              <span className="text-lg font-semibold">/10</span>
            </p>
          </div>
          <div className="w-px h-12 bg-border mx-2" />
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-2">Изменение</p>
            <p className={`text-4xl font-black ${deltaColor}`}>
              {delta >= 0 ? "+" : ""}
              {delta}
            </p>
          </div>
        </div>
      </div>

      {/* Today's protocol */}
      <div className="ps-results-steps bg-card border border-border rounded-2xl p-4 mb-4">
        <p className="text-sm font-semibold mb-3">Сегодняшний протокол</p>
        <div className="ps-results-step-grid flex items-center gap-2 flex-wrap">
          {session.tasks.map((t, i) => {
            const meta = TASK_META[t.id];
            const catMeta = CAT_META[t.category];
            return (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${catMeta.bg} border-transparent`}
                >
                  <TaskIcon taskId={t.id} className={`h-4 w-4 ${catMeta.color}`} />
                  <span className={`text-xs font-semibold ${catMeta.color}`}>{meta.title}</span>
                </div>
                {i < session.tasks.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight */}
      <div className={`ps-results-insight border rounded-2xl p-4 mb-4 ${insightColor}`}>
        <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {insightIcon === "profile" ? (
            <BarChart2 className="h-3.5 w-3.5" />
          ) : insightIcon === "experiment" ? (
            <Sparkles className="h-3.5 w-3.5" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {insightTitle}
        </p>
        <p className="text-sm text-foreground leading-relaxed">{insightBody}</p>
      </div>

      {session.sessionKind !== "recovery" && session.recoveryOffer?.status === "eligible" && (
        <Suspense fallback={<div className="mb-5 h-48 rounded-2xl bg-card" />}>
          <RecoveryOfferCard
            busy={recoveryBusy}
            onStart={() => void onStartRecovery()}
            onDecline={() => void onDeclineRecovery()}
          />
        </Suspense>
      )}

      {/* Follow-up */}
      {session.recoveryOffer?.status !== "eligible" && (
        <div className="ps-follow-up-card bg-card border border-border rounded-2xl p-4 mb-5">
          {!followUpAns ? (
            <>
              <p className="text-sm font-semibold mb-1">Через 15 минут мы проверим</p>
              <p className="text-xs text-muted-foreground mb-3">
                Удалось ли тебе окончательно проснуться — это ключевая метрика.
              </p>
              {!showFollowUp ? (
                <button
                  onClick={() => setShowFollowUp(true)}
                  className="text-sm text-accent underline underline-offset-2"
                >
                  Ответить сейчас
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  {[
                    { val: "up" as FollowUp, label: "Да, уже встал" },
                    { val: "back" as FollowUp, label: "Снова лёг" },
                    {
                      val: "drowsy" as FollowUp,
                      label: "Не лёг, но всё ещё очень сонный",
                    },
                  ].map((opt) => (
                    <button
                      key={String(opt.val)}
                      onClick={() => opt.val && void answerFollowUp(opt.val)}
                      disabled={followUpSaving}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3 text-left text-sm text-foreground transition-transform active:scale-[0.99]"
                    >
                      <FollowUpIcon answer={opt.val!} className="h-5 w-5 text-accent" />
                      {opt.label}
                    </button>
                  ))}
                  {followUpSaving && (
                    <p className="text-xs text-muted-foreground">Сохраняем ответ…</p>
                  )}
                  {followUpError && <p className="text-xs text-red-400">{followUpError}</p>}
                </div>
              )}
            </>
          ) : (
            <div className={`${followUpAns === "up" ? "text-green-400" : "text-red-400"}`}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FollowUpIcon answer={followUpAns} className="h-5 w-5" />
                {followUpAns === "up"
                  ? "Встал и не лёг обратно"
                  : followUpAns === "back"
                    ? "Вернулся в кровать"
                    : "Сонный, но не лёг"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ответ сохранён и учтён в профиле пробуждения
              </p>
            </div>
          )}
        </div>
      )}

      <Suspense fallback={null}>
        <HomeScreenPrompt firstCompletion={evidenceCount === 1} />
      </Suspense>

      {GOAL_CALIBRATION_ENABLED &&
        evidenceCount !== null &&
        evidenceCount >= 1 &&
        evidenceCount <= 3 && (
          <Suspense fallback={null}>
            <MorningExperienceSlot
              mode="scheduled"
              storageScope={localStorageScope}
              sessionNumber={evidenceCount}
              onOpenSettings={onSettings}
            />
          </Suspense>
        )}

      <Suspense fallback={null}>
        <WakeRoutineChecklist sessionId={session.id} routine={routine} demo={demo} />
      </Suspense>

      <div className="flex gap-3">
        <button
          onClick={onHome}
          className="flex-1 py-4 bg-secondary rounded-2xl font-semibold active:scale-[0.98] transition-transform"
        >
          На главную
        </button>
        <button
          onClick={onStats}
          className="flex-1 py-4 rounded-2xl font-semibold text-white active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}
        >
          Статистика
        </button>
      </div>
    </div>
  );
}

const RecoveryOfferCard = lazy(() => import("../features/session/recovery-offer-card.js"));
const HomeScreenPrompt = lazy(async () => ({
  default: (await import("../features/onboarding/home-screen-prompt.js")).HomeScreenPrompt,
}));
const MorningExperienceSlot = lazy(
  () => import("../features/personalization/morning-experience-slot.js"),
);
