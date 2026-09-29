import type { FollowUpOutcome, TaskId, WakeSession } from "../model.js";
import { SessionCommandError } from "../model.js";
import { STRICT_TASK_PROTOCOL_VERSION, taskSuccessTarget } from "../task-policy.js";
import { HANDS_FREE_ORDER } from "../personalization.js";
import { estimatedTaskSeconds } from "../task-policy.js";

interface VersionedCommand {
  expectedVersion: number;
}
interface BaselineCommand extends VersionedCommand {
  value: number;
  observedAt: string;
}
interface TaskResultCommand extends VersionedCommand {
  stepIndex: number;
  taskId: TaskId;
  correct: number;
  total: number;
  durationMs: number;
  completionSource?: "manual" | "timer";
  difficultyLevel?: number;
  observedAt: string;
}
interface PostRatingCommand extends VersionedCommand {
  value: number;
  observedAt: string;
  followUpDelayMinutes: number;
}
interface FollowUpCommand extends VersionedCommand {
  outcome: FollowUpOutcome;
}
interface AbandonCommand extends VersionedCommand {
  observedAt: string;
}

function assertVersion(session: WakeSession, expectedVersion: number): void {
  if (session.version !== expectedVersion) {
    throw new SessionCommandError(
      "stale_version",
      `Stale session version: expected ${expectedVersion}, current ${session.version}`,
    );
  }
}

function assertRating(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new SessionCommandError("invalid_rating", "Rating must be an integer from 1 to 10");
  }
}

function assertActive(session: WakeSession): void {
  if (session.status === "abandoned" || session.status === "protocol_completed") {
    throw new SessionCommandError(
      "invalid_transition",
      `Session in status ${session.status} cannot accept this command`,
    );
  }
}

export function acceptBaseline(session: WakeSession, command: BaselineCommand): WakeSession {
  assertVersion(session, command.expectedVersion);
  assertRating(command.value);
  if (session.status !== "assigned" || session.baseline !== null) {
    throw new SessionCommandError(
      "invalid_transition",
      "Baseline can only be recorded once for an assigned session",
    );
  }
  return {
    ...session,
    status: "in_progress",
    baseline: command.value,
    startedAt: command.observedAt,
    version: session.version + 1,
  };
}

export function acceptTaskResult(session: WakeSession, command: TaskResultCommand): WakeSession {
  assertVersion(session, command.expectedVersion);
  assertActive(session);
  if (session.status !== "in_progress" || session.baseline === null) {
    throw new SessionCommandError(
      "invalid_transition",
      "A baseline must be recorded before task results",
    );
  }
  const effectiveSteps = session.effectiveSteps ?? session.assignment.steps;
  const expectedStep = effectiveSteps[session.currentStepIndex];
  if (
    expectedStep === undefined ||
    command.stepIndex !== session.currentStepIndex ||
    command.taskId !== expectedStep.taskId
  ) {
    throw new SessionCommandError(
      "unexpected_step",
      `Expected step ${session.currentStepIndex}${expectedStep ? ` (${expectedStep.taskId})` : ""}`,
    );
  }
  if (
    !Number.isInteger(command.correct) ||
    !Number.isInteger(command.total) ||
    command.correct < 0 ||
    command.total < 0 ||
    command.correct > command.total ||
    !Number.isInteger(command.durationMs) ||
    command.durationMs < 0 ||
    (command.difficultyLevel !== undefined &&
      (!Number.isInteger(command.difficultyLevel) ||
        command.difficultyLevel < 1 ||
        command.difficultyLevel > 3))
  ) {
    throw new SessionCommandError("invalid_task_result", "Task result values are invalid");
  }
  if (command.completionSource === "timer") {
    const minimumMs =
      estimatedTaskSeconds(
        command.taskId,
        session.durationMinutes,
        session.assignment.protocolVersion,
      ) * 1_000;
    const previousObservedAt = session.tasks.at(-1)?.observedAt ?? session.startedAt;
    if (
      session.experience?.interactionMode !== "hands_free" ||
      (command.taskId !== "sit_edge" && !HANDS_FREE_ORDER.includes(command.taskId)) ||
      command.correct !== 1 ||
      command.total !== 1 ||
      command.durationMs < minimumMs ||
      !previousObservedAt ||
      Date.parse(command.observedAt) - Date.parse(previousObservedAt) < minimumMs
    ) {
      throw new SessionCommandError("invalid_task_result", "Автозавершение задания недоступно");
    }
  }
  if (session.assignment.protocolVersion >= STRICT_TASK_PROTOCOL_VERSION) {
    const target = taskSuccessTarget(
      command.taskId,
      session.durationMinutes,
      session.assignment.protocolVersion,
    );
    if (command.correct < target) {
      throw new SessionCommandError(
        "invalid_task_result",
        `Task requires ${target} successful results before completion`,
      );
    }
  }
  return {
    ...session,
    currentStepIndex: session.currentStepIndex + 1,
    tasks: [
      ...session.tasks,
      {
        stepIndex: command.stepIndex,
        taskId: command.taskId,
        category: expectedStep.category,
        correct: command.correct,
        total: command.total,
        durationMs: command.durationMs,
        completionSource: command.completionSource ?? "manual",
        ...(command.difficultyLevel === undefined
          ? {}
          : { difficultyLevel: command.difficultyLevel }),
        observedAt: command.observedAt,
      },
    ],
    version: session.version + 1,
  };
}

export function acceptPostRating(session: WakeSession, command: PostRatingCommand): WakeSession {
  assertVersion(session, command.expectedVersion);
  assertRating(command.value);
  assertActive(session);
  if (session.status !== "in_progress" || session.baseline === null) {
    throw new SessionCommandError(
      "invalid_transition",
      "A baseline must be recorded before the post rating",
    );
  }
  if (session.currentStepIndex !== (session.effectiveSteps ?? session.assignment.steps).length) {
    throw new SessionCommandError(
      "invalid_transition",
      "All assigned steps must be completed before the post rating",
    );
  }
  if (!Number.isInteger(command.followUpDelayMinutes) || command.followUpDelayMinutes < 0) {
    throw new SessionCommandError(
      "invalid_transition",
      "Follow-up delay must be a non-negative integer",
    );
  }
  const completedAt = new Date(command.observedAt);
  if (Number.isNaN(completedAt.getTime())) {
    throw new SessionCommandError("invalid_transition", "Observed time is invalid");
  }
  const followUpDueAt = new Date(
    completedAt.getTime() + command.followUpDelayMinutes * 60_000,
  ).toISOString();
  return {
    ...session,
    status: "protocol_completed",
    postRating: command.value,
    protocolCompletedAt: command.observedAt,
    followUpDueAt,
    version: session.version + 1,
  };
}

export function acceptFollowUp(session: WakeSession, command: FollowUpCommand): WakeSession {
  assertVersion(session, command.expectedVersion);
  const completedProtocol = session.status === "protocol_completed" && session.postRating !== null;
  const abandonedRecovery = session.status === "abandoned" && session.sessionKind === "recovery";
  if (!completedProtocol && !abandonedRecovery) {
    throw new SessionCommandError("invalid_transition", "Follow-up requires a completed protocol");
  }
  if (session.followUp !== null) {
    throw new SessionCommandError(
      "follow_up_already_recorded",
      "Follow-up has already been recorded",
    );
  }
  return {
    ...session,
    followUp: command.outcome,
    version: session.version + 1,
  };
}

export function abandonSession(session: WakeSession, command: AbandonCommand): WakeSession {
  assertVersion(session, command.expectedVersion);
  assertActive(session);
  return {
    ...session,
    status: "abandoned",
    abandonedAt: command.observedAt,
    version: session.version + 1,
  };
}
