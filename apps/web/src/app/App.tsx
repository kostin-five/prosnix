import { Loader2 } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import { useBootstrap } from "../features/bootstrap/use-bootstrap.js";
import { ProsnixWordmark } from "../features/brand/prosnix-brand.js";
import { LegalGate } from "../features/legal/legal-gate.js";
import { abandonWakeSession } from "../features/session/session-api.js";
const SavedSessionPrompt = lazy(() => import("../features/session/saved-session-prompt.js"));
const BootstrapErrorScreen = lazy(() => import("../features/bootstrap/bootstrap-error-screen.js"));

import { PrototypeApp } from "./wake-app.js";
export { MathTask, MemoryTask, ReactionTask, StroopTask } from "./cognitive-tasks.js";
export { initialProtocolScreen } from "./session-model.js";
export type { FollowUp, Session, TaskCategory, TaskId } from "./session-model.js";
export { TasksContainer } from "./tasks-container.js";
export default function App() {
  const bootstrap = useBootstrap();
  const launchSource = new URLSearchParams(window.location.search).get("source");
  const [resumeAccepted, setResumeAccepted] = useState(launchSource === "wake");
  const [resumeDiscarded, setResumeDiscarded] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  if (bootstrap.status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="ps-start min-h-screen text-foreground flex items-center justify-center p-6"
      >
        <div className="text-center">
          <ProsnixWordmark className="mb-12" />
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-5" />
          <p className="text-lg font-semibold">Загружаем твоё состояние…</p>
          <p className="text-sm text-muted-foreground mt-2">Берём только подтверждённые данные</p>
        </div>
      </div>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <BootstrapErrorScreen
          timedOut={"reason" in bootstrap && bootstrap.reason === "timeout"}
          message={bootstrap.message}
          onRetry={bootstrap.retry}
        />
      </Suspense>
    );
  }

  if (bootstrap.mode === "telegram" && !bootstrap.legal.accepted) {
    return <LegalGate legal={bootstrap.legal} onAccepted={bootstrap.retry} />;
  }

  if (
    bootstrap.mode === "telegram" &&
    bootstrap.data.activeSession &&
    !resumeAccepted &&
    !resumeDiscarded
  ) {
    const active = bootstrap.data.activeSession;
    async function discardActiveSession() {
      setDiscarding(true);
      setDiscardError(null);
      try {
        await abandonWakeSession(active.session.id, active.session.version);
        setResumeDiscarded(true);
      } catch (error) {
        setDiscardError(error instanceof Error ? error.message : "Не удалось завершить сессию");
      } finally {
        setDiscarding(false);
      }
    }
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <SavedSessionPrompt
          sessionKind={active.session.sessionKind ?? "primary"}
          currentStepIndex={active.session.currentStepIndex}
          stepCount={active.protocol.steps.length}
          discarding={discarding}
          error={discardError}
          handsFreeSound={
            active.session.experience?.interactionMode === "hands_free" &&
            active.session.experience?.soundMode === "on"
          }
          onContinue={() => setResumeAccepted(true)}
          onDiscard={() => void discardActiveSession()}
        />
      </Suspense>
    );
  }

  return (
    <PrototypeApp
      demo={bootstrap.mode === "demo"}
      localStorageScope={bootstrap.mode === "telegram" ? bootstrap.data.user.id : "demo"}
      {...(bootstrap.mode === "telegram" && bootstrap.data.activeSession && !resumeDiscarded
        ? { resume: bootstrap.data.activeSession }
        : {})}
      {...(bootstrap.mode === "telegram"
        ? {
            dueFollowUpSessionId: bootstrap.data.dueFollowUpSessionId,
            initialWakeSchedule: bootstrap.data.wakeSchedule,
            initialWakeProfile: bootstrap.data.wakeProfile ?? {
              movementLevel: "none",
              availableResources: [],
              excludedTaskIds: [],
              defaultDurationMinutes: 5,
              onboardingCompleted: false,
              revision: 0,
            },
            initialWakeRoutine: bootstrap.data.wakeRoutine ?? {
              enabled: false,
              items: [],
              revision: 0,
            },
          }
        : {
            initialWakeProfile: {
              movementLevel: "full",
              availableResources: ["water", "bright_light", "floor_space"],
              excludedTaskIds: [],
              defaultDurationMinutes: 5,
              onboardingCompleted: true,
              revision: 0,
            },
            initialWakeRoutine: { enabled: false, items: [], revision: 0 },
          })}
    />
  );
}
