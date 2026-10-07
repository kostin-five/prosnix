import { ProfileExclusionDialog } from "../features/personalization/profile-exclusion-dialog.js";
import { BREATHING_PROTOCOL_VERSION, HANDS_FREE_ORDER, estimatedTaskSeconds } from "@awc/domain";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  saveWakeProfile,
  saveWakeRoutine,
} from "../features/personalization/personalization-api.js";
import { saveWakeSchedule, type WakeSchedule } from "../features/schedule/schedule-api.js";
import {
  SessionConflictError,
  createWakeSession,
  saveBaseline,
  saveFollowUp,
  savePostRating,
  saveTaskResult,
  substituteWakeTask,
} from "../features/session/session-api.js";
import {
  TaskSubmissionGate,
  taskSubmissionConflictMessage,
} from "../features/session/task-submission-gate.js";
import type { WakeSoundMode } from "../features/tasks/task-experience-feedback.js";
import type { TaskSubstitutionReason } from "../features/tasks/task-substitution-sheet.js";
import type {
  BootstrapResponse,
  WakeContext,
  WakeDurationMinutes,
  WakeProfile,
  WakeRoutine,
  WakeSessionResponse,
} from "../shared/api/client.js";
import { LazyBoundary } from "./lazy-boundary.js";
import {
  computeCategoryEffectiveness,
  computeNextPlan,
  MOCK_SESSIONS,
  selectTasks,
} from "./demo-planning.js";

const GOAL_CALIBRATION_ENABLED = import.meta.env.VITE_GOAL_CALIBRATION_ENABLED !== "false";
const GUIDED_TASK_EXPERIENCE_ENABLED =
  import.meta.env.VITE_GUIDED_TASK_EXPERIENCE_ENABLED !== "false";
const WAKE_TASK_SUBSTITUTION_ENABLED =
  import.meta.env.VITE_WAKE_TASK_SUBSTITUTION_ENABLED !== "false";

const HomeScreen = lazy(() => import("../features/home/home-screen.js"));
const SettingsScreen = lazy(() => import("../features/settings/settings-screen.js"));
const StartRatingScreen = lazy(async () => ({
  default: (await import("../features/session/rating-screens.js")).StartRatingScreen,
}));
const EndRatingScreen = lazy(async () => ({
  default: (await import("../features/session/rating-screens.js")).EndRatingScreen,
}));
const CapabilityOnboardingScreen = lazy(
  () => import("../features/personalization/capability-onboarding-screen.js"),
);
const WakeContextSheet = lazy(async () => ({
  default: (await import("../features/personalization/wake-context-sheet.js")).WakeContextSheet,
}));

import { BottomNav } from "./bottom-nav.js";
import { ResultsScreen } from "./results-screen.js";
import {
  CAT_META,
  FollowUpIcon,
  TASK_META,
  initialProtocolScreen,
  resumedServerSession,
  screenForSession,
  sendTaskFeedback,
  type FollowUp,
  type Screen,
  type Session,
  type TaskId,
  type TaskResult,
} from "./session-model.js";
import { TasksContainer } from "./tasks-container.js";
const StatsScreen = lazy(() => import("../features/analytics/stats-screen.js"));

export function PrototypeApp({
  demo,
  localStorageScope,
  resume,
  dueFollowUpSessionId,
  initialWakeSchedule,
  initialWakeProfile,
  initialWakeRoutine,
}: {
  demo: boolean;
  localStorageScope: string;
  resume?: NonNullable<BootstrapResponse["activeSession"]>;
  dueFollowUpSessionId?: string | null;
  initialWakeSchedule?: WakeSchedule | null;
  initialWakeProfile: WakeProfile;
  initialWakeRoutine: WakeRoutine;
}) {
  const launchSource = new URLSearchParams(window.location.search).get("source");
  const resumedTaskIds = (resume?.protocol.effectiveSteps ?? resume?.protocol.steps ?? [])
    .map(({ taskId }) => taskId)
    .filter((taskId): taskId is TaskId => taskId in TASK_META);
  const [screen, setScreen] = useState<Screen>(() =>
    initialProtocolScreen(resume, launchSource, initialWakeProfile.onboardingCompleted),
  );
  const [statsVisited, setStatsVisited] = useState(false);
  const [navTab, setNavTab] = useState<"home" | "stats" | "settings">("home");
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    "capabilities" | "goal" | null
  >(null);
  const [alarmTime, setAlarmTime] = useState(initialWakeSchedule?.localTime ?? "07:00");
  const [wakeSchedule, setWakeSchedule] = useState<WakeSchedule | null>(
    initialWakeSchedule ?? null,
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(demo ? MOCK_SESSIONS : []);
  const [serverSession, setServerSession] = useState<WakeSessionResponse | null>(
    resume ? resumedServerSession(resume) : null,
  );
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dueFollowUp, setDueFollowUp] = useState(dueFollowUpSessionId ?? null);
  const [wakeProfile, setWakeProfile] = useState(initialWakeProfile);
  const [wakeRoutine, setWakeRoutine] = useState(initialWakeRoutine);
  const [personalizationSaving, setPersonalizationSaving] = useState(false);

  const [taskIds, setTaskIds] = useState<TaskId[]>(resumedTaskIds);
  const [taskIndex, setTaskIndex] = useState(resume?.session.currentStepIndex ?? 0);
  const [activeDurationMinutes, setActiveDurationMinutes] = useState<WakeDurationMinutes>(
    resume?.session.durationMinutes ?? initialWakeProfile.defaultDurationMinutes,
  );
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [autoResumeBlocked, setAutoResumeBlocked] = useState(false);
  const [startAlertness, setStartAlertness] = useState(resume?.baseline ?? 0);
  const [soundMode, setSoundMode] = useState<WakeSoundMode>(
    resume?.session.experience?.soundMode === "on" ? "on" : "off",
  );
  const [interactionMode, setInteractionMode] = useState<"manual" | "hands_free">(
    resume?.session.experience?.interactionMode === "hands_free" ? "hands_free" : "manual",
  );
  const sessionStartRef = useRef(Date.now());
  const taskSubmissionGateRef = useRef(new TaskSubmissionGate());
  const [taskRenderVersion, setTaskRenderVersion] = useState(0);
  const [completedSession, setCompletedSession] = useState<Session | null>(null);
  const [pendingProfileExclusion, setPendingProfileExclusion] = useState<TaskId | null>(null);
  const directWakeStartedRef = useRef(false);

  useEffect(() => {
    taskSubmissionGateRef.current.reset();
  }, [serverSession?.id, taskIndex]);

  useEffect(() => {
    if (
      launchSource !== "wake" ||
      resume ||
      !wakeProfile.onboardingCompleted ||
      directWakeStartedRef.current
    ) {
      return;
    }
    directWakeStartedRef.current = true;
    void startSession("night_sleep", wakeProfile.defaultDurationMinutes);
  }, [launchSource, resume, wakeProfile.defaultDurationMinutes, wakeProfile.onboardingCompleted]);

  async function saveScheduleSetting(input: {
    localTime: string;
    timezone: string;
    enabled: boolean;
  }): Promise<void> {
    setScheduleSaving(true);
    setSyncError(null);
    try {
      const saved = demo
        ? {
            ...input,
            nextTriggerAt: input.enabled
              ? new Date(Date.now() + 24 * 60 * 60_000).toISOString()
              : null,
            botStatus: "unknown" as const,
            revision: (wakeSchedule?.revision ?? 0) + 1,
          }
        : await saveWakeSchedule(input);
      setWakeSchedule(saved);
      setAlarmTime(saved.localTime);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось сохранить напоминание");
      throw error;
    } finally {
      setScheduleSaving(false);
    }
  }

  function applyConflict(error: unknown, submittedStepIndex?: number): void {
    if (error instanceof SessionConflictError && error.canonicalSession) {
      const canonical = error.canonicalSession;
      const canonicalTaskIds = (canonical.effectiveSteps ?? canonical.assignment.steps)
        .map(({ taskId }) => taskId)
        .filter((taskId): taskId is TaskId => taskId in TASK_META);
      setServerSession(canonical);
      setTaskIndex(canonical.currentStepIndex);
      setTaskIds(canonicalTaskIds);
      setStartAlertness(canonical.baseline ?? 0);
      setScreen(screenForSession(canonical, canonicalTaskIds.length));
      setSyncError(
        taskSubmissionConflictMessage(
          error.code,
          submittedStepIndex,
          error.canonicalSession.currentStepIndex,
        ),
      );
      return;
    }
    setSyncError(error instanceof Error ? error.message : "Действие пока не подтверждено сервером");
  }

  async function startSession(
    wakeContext: WakeContext,
    durationMinutes: WakeDurationMinutes,
    mode: "manual" | "hands_free" = "manual",
  ) {
    setSyncError(null);
    setAutoResumeBlocked(false);
    setSoundMode(mode === "hands_free" ? "on" : "off");
    setInteractionMode(mode);
    setActiveDurationMinutes(durationMinutes);
    sessionStartRef.current = Date.now();
    if (demo) {
      const ids =
        mode === "hands_free"
          ? (["breathing", "notice_three", "find_color"] as TaskId[])
          : selectTasks(sessions.length, sessions);
      setTaskIds(ids);
      setTaskIndex(0);
      setTaskResults([]);
      setStartAlertness(0);
      setScreen("startRating");
      return;
    }
    setSyncing(true);
    try {
      const created = await createWakeSession(
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        wakeContext,
        durationMinutes,
        mode,
      );
      setServerSession(created);
      setTaskIds(
        (created.effectiveSteps ?? created.assignment.steps)
          .map(({ taskId }) => taskId)
          .filter((taskId): taskId is TaskId => taskId in TASK_META),
      );
      setTaskIndex(created.currentStepIndex);
      setTaskResults([]);
      setStartAlertness(0);
      setScreen("startRating");
    } catch (error) {
      applyConflict(error);
    } finally {
      setSyncing(false);
    }
  }

  async function handleStartRating(v: number) {
    setSyncError(null);
    if (demo) {
      setStartAlertness(v);
      setScreen("tasks");
      return;
    }
    if (!serverSession) return;
    setSyncing(true);
    try {
      const updated = await saveBaseline(serverSession.id, serverSession.version, v, soundMode);
      setServerSession(updated);
      setStartAlertness(v);
      setScreen("tasks");
    } catch (error) {
      applyConflict(error);
    } finally {
      setSyncing(false);
    }
  }

  async function handleTaskDone(result: TaskResult) {
    if (!taskSubmissionGateRef.current.acquire(taskIds[taskIndex], result.id)) return;
    setSyncError(null);
    if (demo) {
      const next = [...taskResults, result];
      setTaskResults(next);
      sendTaskFeedback("success", soundMode);
      if (taskIndex + 1 < taskIds.length) setTaskIndex((i) => i + 1);
      else setScreen("endRating");
      return;
    }
    if (!serverSession) return;
    setSyncing(true);
    try {
      const updated = await saveTaskResult(serverSession.id, serverSession.version, taskIndex, {
        taskId: result.id,
        correct: result.correct,
        total: result.total,
        durationMs: result.timeMs,
        ...(result.completionSource ? { completionSource: result.completionSource } : {}),
        ...(result.difficultyLevel === undefined
          ? {}
          : { difficultyLevel: result.difficultyLevel }),
      });
      setServerSession(updated);
      const updatedTaskIds = (updated.effectiveSteps ?? updated.assignment.steps)
        .map(({ taskId }) => taskId)
        .filter((taskId): taskId is TaskId => taskId in TASK_META);
      setTaskIds(updatedTaskIds);
      setTaskResults((current) => [...current, result]);
      setTaskIndex(updated.currentStepIndex);
      setAutoResumeBlocked(false);
      sendTaskFeedback("success", soundMode);
      if (updated.currentStepIndex >= updatedTaskIds.length) setScreen("endRating");
    } catch (error) {
      taskSubmissionGateRef.current.reset();
      if (interactionMode === "hands_free") setAutoResumeBlocked(true);
      setTaskRenderVersion((version) => version + 1);
      sendTaskFeedback("error", soundMode);
      applyConflict(error, taskIndex);
    } finally {
      setSyncing(false);
    }
  }

  async function handleTaskReplacement(
    stepIndex: number,
    reason: TaskSubstitutionReason,
  ): Promise<void> {
    const originalTaskId = taskIds[stepIndex];
    if (!originalTaskId) return;
    setSyncError(null);
    if (demo) {
      const candidates: readonly TaskId[] =
        interactionMode === "hands_free"
          ? HANDS_FREE_ORDER
          : (["reaction", "stroop", "memory", "math", "shake"] as TaskId[]);
      const replacement = candidates.find(
        (taskId) => taskId !== originalTaskId && !taskIds.includes(taskId),
      );
      if (!replacement) {
        setSyncError("Нет доступной замены с учётом твоих настроек и уже выбранных заданий.");
        return;
      }
      setTaskIds((current) =>
        current.map((taskId, index) => (index === stepIndex ? replacement : taskId)),
      );
      if (reason === "cannot_do") setPendingProfileExclusion(originalTaskId);
      return;
    }
    if (!serverSession) return;
    setSyncing(true);
    try {
      const updated = await substituteWakeTask(
        serverSession.id,
        serverSession.version,
        stepIndex,
        reason,
      );
      const updatedTaskIds = (updated.effectiveSteps ?? updated.assignment.steps)
        .map(({ taskId }) => taskId)
        .filter((taskId): taskId is TaskId => taskId in TASK_META);
      setServerSession(updated);
      setTaskIds(updatedTaskIds);
      if (reason === "cannot_do") setPendingProfileExclusion(originalTaskId);
    } catch (error) {
      if (error instanceof SessionConflictError && error.code === "no_alternative") {
        if (error.canonicalSession) {
          setServerSession(error.canonicalSession);
          setTaskIds(
            (error.canonicalSession.effectiveSteps ?? error.canonicalSession.assignment.steps)
              .map(({ taskId }) => taskId)
              .filter((taskId): taskId is TaskId => taskId in TASK_META),
          );
        }
        setSyncError("Нет доступной замены с учётом твоих настроек и уже выбранных заданий.");
      } else {
        applyConflict(error);
      }
    } finally {
      setSyncing(false);
    }
  }

  async function confirmProfileExclusion(): Promise<void> {
    if (!pendingProfileExclusion) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await updateWakeProfile({
        movementLevel: wakeProfile.movementLevel,
        availableResources: wakeProfile.availableResources,
        excludedTaskIds: [...new Set([...wakeProfile.excludedTaskIds, pendingProfileExclusion])],
        defaultDurationMinutes: wakeProfile.defaultDurationMinutes,
        onboardingCompleted: wakeProfile.onboardingCompleted,
      });
      setPendingProfileExclusion(null);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось обновить ограничения");
    } finally {
      setSyncing(false);
    }
  }

  const [endEarly, setEndEarly] = useState(false);

  async function handleEndRating(endAlertness: number) {
    setSyncError(null);
    let confirmedTasks = taskResults;
    let confirmedServerSession = serverSession;
    if (!demo) {
      if (!serverSession) return;
      setSyncing(true);
      try {
        const updated = await savePostRating(
          serverSession.id,
          serverSession.version,
          endAlertness,
          endEarly ? "awakened" : undefined,
        );
        setServerSession(updated);
        confirmedServerSession = updated;
        confirmedTasks = updated.tasks
          .filter(({ taskId }) => taskId in TASK_META)
          .map((task) => ({
            id: task.taskId as TaskId,
            category: task.category,
            correct: task.correct,
            total: task.total,
            timeMs: task.durationMs,
            ...(task.difficultyLevel === undefined
              ? {}
              : { difficultyLevel: task.difficultyLevel }),
          }));
      } catch (error) {
        applyConflict(error);
        setSyncing(false);
        return;
      }
      setSyncing(false);
    }
    const session: Session = {
      id: serverSession?.id ?? `s${Date.now()}`,
      completedEarly: demo ? endEarly : confirmedServerSession?.experience?.completedEarly === true,
      date: new Date().toLocaleDateString("ru", { day: "numeric", month: "short" }),
      wakeTime: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      startAlertness,
      tasks: confirmedTasks,
      endAlertness,
      followUp: null,
      totalMs: Date.now() - sessionStartRef.current,
      sessionKind: confirmedServerSession?.sessionKind ?? "primary",
      parentSessionId: confirmedServerSession?.parentSessionId ?? null,
      recoveryOffer: confirmedServerSession?.recoveryOffer ?? null,
    };
    setCompletedSession(session);
    setSessions((prev) => [...prev, session]);
    setScreen("results");
    setEndEarly(false);
  }

  async function handleStartRecovery(): Promise<void> {
    if (demo || !serverSession || serverSession.recoveryOffer?.status !== "eligible") return;
    setSyncing(true);
    setSyncError(null);
    try {
      const { startRecoverySession } = await import("../features/session/recovery-api.js");
      const recovery = await startRecoverySession(serverSession.id, serverSession.version);
      const recoveryTaskIds = (recovery.effectiveSteps ?? recovery.assignment.steps)
        .map(({ taskId }) => taskId)
        .filter((taskId): taskId is TaskId => taskId in TASK_META);
      setServerSession(recovery);
      setTaskIds(recoveryTaskIds);
      setTaskIndex(recovery.currentStepIndex);
      setTaskResults([]);
      setStartAlertness(recovery.baseline ?? serverSession.postRating ?? 1);
      setCompletedSession(null);
      sessionStartRef.current = Date.now();
      taskSubmissionGateRef.current.reset();
      setScreen("tasks");
    } catch (error) {
      applyConflict(error);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeclineRecovery(): Promise<void> {
    if (demo || !serverSession || serverSession.recoveryOffer?.status !== "eligible") return;
    setSyncing(true);
    setSyncError(null);
    try {
      const { declineRecoverySession } = await import("../features/session/recovery-api.js");
      const updated = await declineRecoverySession(serverSession.id, serverSession.version);
      setServerSession(updated);
      setCompletedSession((current) =>
        current ? { ...current, recoveryOffer: updated.recoveryOffer ?? null } : current,
      );
    } catch (error) {
      applyConflict(error);
    } finally {
      setSyncing(false);
    }
  }

  async function handleFollowUp(answer: Exclude<FollowUp, null>) {
    if (demo) {
      setSessions((current) =>
        current.map((session) =>
          session.id === completedSession?.id ? { ...session, followUp: answer } : session,
        ),
      );
      return;
    }
    const sessionId = serverSession?.id ?? completedSession?.id;
    if (!sessionId) throw new Error("Не удалось определить сессию для follow-up");
    const updated = await saveFollowUp(sessionId, answer);
    setServerSession(updated);
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId ? { ...session, followUp: answer } : session,
      ),
    );
  }

  async function answerDueFollowUp(answer: Exclude<FollowUp, null>) {
    if (!dueFollowUp) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await saveFollowUp(dueFollowUp, answer);
      setDueFollowUp(null);
    } catch (error) {
      applyConflict(error);
    } finally {
      setSyncing(false);
    }
  }

  function handleNavTab(tab: "home" | "stats" | "settings") {
    if (tab === "stats") setStatsVisited(true);
    setSettingsInitialSection(null);
    setNavTab(tab);
    setScreen(tab);
  }

  const showNav = screen === "home" || screen === "stats" || screen === "settings";

  async function updateWakeProfile(input: Omit<WakeProfile, "revision">): Promise<void> {
    setPersonalizationSaving(true);
    try {
      setWakeProfile(
        demo
          ? { ...input, revision: wakeProfile.revision + 1 }
          : await saveWakeProfile(input, wakeProfile.revision),
      );
    } finally {
      setPersonalizationSaving(false);
    }
  }

  function finishOnboarding(): void {
    if (launchSource === "wake") {
      setScreen("startRating");
      return;
    }
    setNavTab("home");
    setScreen("home");
  }

  function openGoalSettings(): void {
    setSettingsInitialSection("goal");
    setNavTab("settings");
    setScreen("settings");
  }

  async function updateWakeRoutine(input: Omit<WakeRoutine, "revision">): Promise<void> {
    setPersonalizationSaving(true);
    try {
      setWakeRoutine(
        demo
          ? { ...input, revision: wakeRoutine.revision + 1 }
          : await saveWakeRoutine(input, wakeRoutine.revision),
      );
    } finally {
      setPersonalizationSaving(false);
    }
  }

  if (dueFollowUp && !serverSession) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Проверка подъёма
          </p>
          <h1 className="mt-2 text-2xl font-bold">Ты окончательно проснулся?</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ответ будет связан с сохранённой сессией и поможет честно оценить протокол.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              disabled={syncing}
              onClick={() => void answerDueFollowUp("up")}
              className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"
            >
              <FollowUpIcon answer="up" className="h-5 w-5 text-accent" />
              Да, уже встал
            </button>
            <button
              disabled={syncing}
              onClick={() => void answerDueFollowUp("back")}
              className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"
            >
              <FollowUpIcon answer="back" className="h-5 w-5 text-accent" />
              Снова лёг
            </button>
            <button
              disabled={syncing}
              onClick={() => void answerDueFollowUp("drowsy")}
              className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left"
            >
              <FollowUpIcon answer="drowsy" className="h-5 w-5 text-yellow-400" />
              Не лёг, но ещё сонный
            </button>
          </div>
          {syncing && <p className="mt-3 text-xs text-muted-foreground">Сохраняем ответ…</p>}
          {syncError && <p className="mt-3 text-xs text-red-400">{syncError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start justify-center bg-background text-foreground ${screen === "tasks" || showNav ? "h-[100dvh] overflow-hidden" : "min-h-screen"}`}
    >
      <div
        className={`w-full max-w-[390px] flex flex-col bg-background relative ${screen === "tasks" || showNav ? "h-full min-h-0" : "min-h-screen"}`}
      >
        {(syncing || (syncError && screen !== "tasks")) && (
          <div
            role="status"
            className="shrink-0 border-b border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground"
          >
            {(screen !== "tasks" && syncError) || "Сохраняем подтверждённое состояние…"}
          </div>
        )}
        {pendingProfileExclusion && (
          <ProfileExclusionDialog
            title={TASK_META[pendingProfileExclusion].title}
            busy={syncing}
            onClose={() => setPendingProfileExclusion(null)}
            onConfirm={() => void confirmProfileExclusion()}
          />
        )}
        {screen === "home" && (
          <Suspense
            fallback={
              <div className="ps-home flex-1 p-5 text-muted-foreground">Загружаем главную…</div>
            }
          >
            <HomeScreen
              onStart={() => setScreen("context")}
              sessions={sessions}
              demo={demo}
              localStorageScope={localStorageScope}
              onOpenSettings={() => handleNavTab("settings")}
              onOpenGoal={openGoalSettings}
            />
          </Suspense>
        )}
        {screen === "onboarding" && (
          <Suspense
            fallback={
              <div className="p-5 text-sm text-muted-foreground">Готовим первую настройку…</div>
            }
          >
            <CapabilityOnboardingScreen
              profile={wakeProfile}
              saving={personalizationSaving}
              onSave={updateWakeProfile}
              onCompleted={finishOnboarding}
            />
          </Suspense>
        )}
        {screen === "context" && (
          <Suspense
            fallback={
              <div className="p-5 text-sm text-muted-foreground">Готовим параметры сессии…</div>
            }
          >
            <WakeContextSheet
              defaultDuration={wakeProfile.defaultDurationMinutes}
              profileComplete={wakeProfile.onboardingCompleted}
              busy={syncing}
              onCancel={() => setScreen("home")}
              onOpenProfile={() => {
                setSettingsInitialSection("capabilities");
                setNavTab("settings");
                setScreen("settings");
              }}
              onStart={(context, duration, mode) => void startSession(context, duration, mode)}
            />
          </Suspense>
        )}
        {(statsVisited || screen === "stats") && (
          <div
            className={screen === "stats" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
            hidden={screen !== "stats"}
          >
            <Suspense
              fallback={
                <div className="p-5 text-sm text-muted-foreground">Загружаем статистику…</div>
              }
            >
              <StatsScreen
                active={screen === "stats"}
                sessions={sessions}
                demo={demo}
                routine={wakeRoutine}
                profile={wakeProfile}
                taskMetaMap={TASK_META}
                categoryMeta={CAT_META}
                computeCategoryEffectiveness={computeCategoryEffectiveness}
                computeNextPlan={computeNextPlan}
              />
            </Suspense>
          </div>
        )}
        {screen === "settings" && (
          <LazyBoundary>
            <Suspense
              fallback={
                <div className="p-5 text-sm text-muted-foreground">Загружаем настройки…</div>
              }
            >
              <SettingsScreen
                initialSection={settingsInitialSection}
                alarmTime={alarmTime}
                schedule={wakeSchedule}
                saving={scheduleSaving}
                demo={demo}
                onScheduleSave={saveScheduleSetting}
                wakeProfile={wakeProfile}
                wakeRoutine={wakeRoutine}
                personalizationSaving={personalizationSaving}
                onProfileSave={updateWakeProfile}
                onRoutineSave={updateWakeRoutine}
                localStorageScope={localStorageScope}
                goalCalibrationEnabled={GOAL_CALIBRATION_ENABLED}
              />
            </Suspense>
          </LazyBoundary>
        )}
        {screen === "startRating" && (
          <Suspense
            fallback={<div className="p-5 text-sm text-muted-foreground">Готовим оценку…</div>}
          >
            <StartRatingScreen
              onDone={handleStartRating}
              ready={demo || Boolean(serverSession)}
              busy={syncing}
              localStorageScope={localStorageScope}
              soundMode={soundMode}
              interactionMode={interactionMode}
              plannedSeconds={taskIds.reduce(
                (total, taskId) =>
                  total +
                  estimatedTaskSeconds(
                    taskId,
                    serverSession?.durationMinutes ?? activeDurationMinutes,
                    serverSession?.assignment.protocolVersion ?? BREATHING_PROTOCOL_VERSION,
                  ),
                0,
              )}
              onSoundModeChange={setSoundMode}
              goalCalibrationEnabled={GOAL_CALIBRATION_ENABLED}
              guidedExperience={GUIDED_TASK_EXPERIENCE_ENABLED}
              onRetry={
                launchSource === "wake" && !serverSession
                  ? () => void startSession("night_sleep", wakeProfile.defaultDurationMinutes)
                  : undefined
              }
            />
          </Suspense>
        )}
        {screen === "tasks" && (
          <TasksContainer
            key={`${serverSession?.id ?? "demo"}-${taskIndex}-${taskRenderVersion}`}
            taskIds={taskIds}
            taskIndex={taskIndex}
            durationMinutes={serverSession?.durationMinutes ?? activeDurationMinutes}
            protocolVersion={
              serverSession?.assignment.protocolVersion ?? BREATHING_PROTOCOL_VERSION
            }
            soundMode={soundMode}
            onSoundModeChange={setSoundMode}
            submitting={syncing}
            interactionMode={interactionMode}
            localStorageScope={localStorageScope}
            autoResumeBlocked={autoResumeBlocked}
            onResumeAuto={() => setAutoResumeBlocked(false)}
            notice={syncError}
            onDismissNotice={() => setSyncError(null)}
            substitutionEnabled={WAKE_TASK_SUBSTITUTION_ENABLED}
            onReplace={(stepIndex, reason) => void handleTaskReplacement(stepIndex, reason)}
            onDone={handleTaskDone}
            onAwakened={() => {
              if (!syncing) {
                setEndEarly(true);
                setScreen("endRating");
              }
            }}
          />
        )}
        {screen === "endRating" && (
          <Suspense
            fallback={<div className="p-5 text-sm text-muted-foreground">Готовим оценку…</div>}
          >
            <EndRatingScreen startAlertness={startAlertness} onDone={handleEndRating} />
          </Suspense>
        )}
        {screen === "results" && completedSession && (
          <ResultsScreen
            session={completedSession}
            allSessions={sessions}
            onStats={() => handleNavTab("stats")}
            onHome={() => handleNavTab("home")}
            onSettings={() => handleNavTab("settings")}
            onFollowUp={handleFollowUp}
            onStartRecovery={handleStartRecovery}
            onDeclineRecovery={handleDeclineRecovery}
            recoveryBusy={syncing}
            localStorageScope={localStorageScope}
            routine={wakeRoutine}
            demo={demo}
          />
        )}
        {showNav && <BottomNav current={navTab} onTab={handleNavTab} />}
      </div>
    </div>
  );
}
