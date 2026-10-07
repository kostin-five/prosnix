import { and, asc, eq, inArray } from "drizzle-orm";

import {
  categoryForTask,
  SAFE_WAKE_PROFILE,
  selectRecoverySteps,
  type ExperimentAssignment,
  type ProtocolStep,
  type SessionCommand,
  type TaskCategory,
  type TaskId,
  type WakeCapabilityProfile,
  type WakeExperienceSnapshot,
  type WakePersonalizationSnapshot,
  type WakeSession,
} from "@awc/domain";
import {
  experimentAssignments,
  followUpObservations,
  protocolDefinitions,
  ratingObservations,
  sessionTaskSubstitutions,
  taskObservations,
  wakeCapabilityProfiles,
  wakeSessions,
} from "../schema.js";
import type { Database } from "./types.js";

export interface SessionRepositoryOptions {
  wakeTaskCatalogV9Enabled: boolean;
  wakeLowEffectRecoveryEnabled: boolean;
}

export const DEFAULT_OPTIONS: SessionRepositoryOptions = {
  wakeTaskCatalogV9Enabled: false,
  wakeLowEffectRecoveryEnabled: false,
};

const TASK_IDS = new Set<TaskId>([
  "math",
  "memory",
  "stroop",
  "reaction",
  "steps",
  "squats",
  "shake",
  "water",
  "window",
  "curtains",
  "sit_edge",
  "cool_wash",
  "pushups",
  "notice_three",
  "find_color",
  "breathing",
]);
const CATEGORIES = new Set<TaskCategory>(["cognitive", "movement", "behavioral", "environment"]);
export function parseSteps(value: unknown): readonly ProtocolStep[] {
  if (!Array.isArray(value)) throw new Error("Protocol steps are not an array");
  return value.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("Protocol step is invalid");
    }
    const step = item as Record<string, unknown>;
    if (
      step.index !== index ||
      typeof step.taskId !== "string" ||
      !TASK_IDS.has(step.taskId as TaskId) ||
      typeof step.category !== "string" ||
      !CATEGORIES.has(step.category as TaskCategory)
    ) {
      throw new Error("Protocol step contract is invalid");
    }
    return {
      index,
      taskId: step.taskId as TaskId,
      category: step.category as TaskCategory,
    };
  });
}

export function parseSnapshot(value: unknown): WakePersonalizationSnapshot {
  if (typeof value !== "object" || value === null) {
    return {
      profileRevision: 0,
      movementLevel: "none",
      availableResources: [],
      excludedTaskIds: [],
      fallbackReason: "profile_missing",
    };
  }
  const snapshot = value as Partial<WakePersonalizationSnapshot>;
  return {
    profileRevision: typeof snapshot.profileRevision === "number" ? snapshot.profileRevision : 0,
    movementLevel:
      snapshot.movementLevel === "light" || snapshot.movementLevel === "full"
        ? snapshot.movementLevel
        : "none",
    availableResources: Array.isArray(snapshot.availableResources)
      ? snapshot.availableResources.filter(
          (resource): resource is WakeCapabilityProfile["availableResources"][number] =>
            resource === "water" ||
            resource === "bright_light" ||
            resource === "floor_space" ||
            resource === "wash_access" ||
            resource === "active_movement",
        )
      : [],
    excludedTaskIds: Array.isArray(snapshot.excludedTaskIds)
      ? snapshot.excludedTaskIds.filter(
          (taskId): taskId is TaskId =>
            typeof taskId === "string" && TASK_IDS.has(taskId as TaskId),
        )
      : [],
    fallbackReason:
      snapshot.fallbackReason === "none" || snapshot.fallbackReason === "limited_eligible_tasks"
        ? snapshot.fallbackReason
        : "profile_missing",
  };
}

export function parseExperienceSnapshot(value: unknown): WakeExperienceSnapshot {
  if (typeof value !== "object" || value === null) return { soundMode: "unknown" };
  const soundMode = (value as { soundMode?: unknown }).soundMode;
  const interactionMode = (value as { interactionMode?: unknown }).interactionMode;
  return {
    soundMode: soundMode === "on" || soundMode === "off" ? soundMode : "unknown",
    interactionMode: interactionMode === "hands_free" ? "hands_free" : "manual",
    ...((value as { completedEarly?: unknown }).completedEarly === true
      ? { completedEarly: true }
      : {}),
  };
}

export function mapProfile(
  row: typeof wakeCapabilityProfiles.$inferSelect | undefined,
): WakeCapabilityProfile {
  if (!row) return SAFE_WAKE_PROFILE;
  return {
    movementLevel: row.movementLevel,
    availableResources: Array.isArray(row.availableResources)
      ? row.availableResources.filter(
          (resource): resource is WakeCapabilityProfile["availableResources"][number] =>
            resource === "water" ||
            resource === "bright_light" ||
            resource === "floor_space" ||
            resource === "wash_access" ||
            resource === "active_movement",
        )
      : [],
    excludedTaskIds: Array.isArray(row.excludedTaskIds)
      ? row.excludedTaskIds.filter(
          (taskId): taskId is TaskId =>
            typeof taskId === "string" && TASK_IDS.has(taskId as TaskId),
        )
      : [],
    defaultDurationMinutes: row.defaultDurationMinutes as 2 | 5 | 10,
    onboardingCompleted: row.onboardingCompletedAt !== null,
    revision: row.revision,
  };
}

export async function loadSession(
  db: Database,
  userId: string,
  sessionId: string,
  options: SessionRepositoryOptions = DEFAULT_OPTIONS,
): Promise<WakeSession | null> {
  const [aggregate] = await db
    .select({
      session: wakeSessions,
      assignment: experimentAssignments,
      protocol: protocolDefinitions,
    })
    .from(wakeSessions)
    .innerJoin(experimentAssignments, eq(wakeSessions.assignmentId, experimentAssignments.id))
    .innerJoin(
      protocolDefinitions,
      eq(experimentAssignments.protocolDefinitionId, protocolDefinitions.id),
    )
    .where(and(eq(wakeSessions.userId, userId), eq(wakeSessions.id, sessionId)))
    .limit(1);
  if (!aggregate) return null;

  const [ratings, tasks, followUps, substitutionRows, sourceRatings, linkedRecovery] =
    await Promise.all([
      db.select().from(ratingObservations).where(eq(ratingObservations.sessionId, sessionId)),
      db
        .select()
        .from(taskObservations)
        .where(eq(taskObservations.sessionId, sessionId))
        .orderBy(asc(taskObservations.protocolStepIndex)),
      db
        .select()
        .from(followUpObservations)
        .where(eq(followUpObservations.sessionId, sessionId))
        .limit(1),
      db
        .select()
        .from(sessionTaskSubstitutions)
        .where(eq(sessionTaskSubstitutions.sessionId, sessionId))
        .orderBy(asc(sessionTaskSubstitutions.createdAt), asc(sessionTaskSubstitutions.id)),
      aggregate.session.baselineSourceSessionId
        ? db
            .select()
            .from(ratingObservations)
            .where(eq(ratingObservations.sessionId, aggregate.session.baselineSourceSessionId))
        : Promise.resolve([]),
      aggregate.session.sessionKind === "primary"
        ? db
            .select({ id: wakeSessions.id })
            .from(wakeSessions)
            .where(
              and(
                eq(wakeSessions.userId, userId),
                eq(wakeSessions.parentSessionId, aggregate.session.id),
              ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    ]);
  const comparison: ExperimentAssignment["comparison"] =
    aggregate.assignment.comparisonGroupKey &&
    aggregate.assignment.evaluatedFactor &&
    (aggregate.assignment.comparisonLevel === "with" ||
      aggregate.assignment.comparisonLevel === "without")
      ? {
          groupKey: aggregate.assignment.comparisonGroupKey,
          factorKey: aggregate.assignment.evaluatedFactor,
          level: aggregate.assignment.comparisonLevel as "with" | "without",
        }
      : undefined;

  const assignedSteps = parseSteps(aggregate.protocol.steps);
  const effectiveSteps = assignedSteps.map((step) => ({ ...step }));
  for (const substitution of substitutionRows) {
    const current = effectiveSteps[substitution.stepIndex];
    if (!current) continue;
    effectiveSteps[substitution.stepIndex] = {
      index: substitution.stepIndex,
      taskId: substitution.replacementTaskId as TaskId,
      category: categoryForTask(substitution.replacementTaskId as TaskId),
    };
  }

  const session: WakeSession = {
    id: aggregate.session.id,
    userId: aggregate.session.userId,
    assignment: {
      id: aggregate.assignment.id,
      protocolKey: aggregate.protocol.protocolKey,
      protocolVersion: aggregate.protocol.version,
      strategyVersion: aggregate.assignment.strategyVersion,
      phase: aggregate.assignment.phase,
      hypothesis: aggregate.assignment.hypothesis,
      steps: assignedSteps,
      ...(comparison ? { comparison } : {}),
    },
    effectiveSteps,
    substitutions: substitutionRows.map((substitution) => ({
      id: substitution.id,
      stepIndex: substitution.stepIndex,
      originalTaskId: substitution.originalTaskId as TaskId,
      replacementTaskId: substitution.replacementTaskId as TaskId,
      reason: substitution.reason,
      operationId: substitution.operationId,
      createdAt: substitution.createdAt.toISOString(),
    })),
    sessionKind: aggregate.session.sessionKind,
    parentSessionId: aggregate.session.parentSessionId,
    recoveryBaseline:
      aggregate.session.baselineSourceSessionId &&
      aggregate.session.baselineSourceRatingKind === "post_protocol"
        ? {
            sessionId: aggregate.session.baselineSourceSessionId,
            ratingKind: "post_protocol",
          }
        : null,
    recoveryOffer:
      aggregate.session.sessionKind !== "primary"
        ? null
        : linkedRecovery
          ? {
              status: "accepted",
              maxDurationSeconds: 90,
              recoverySessionId: linkedRecovery.id,
            }
          : aggregate.session.recoveryOfferDeclinedAt
            ? { status: "declined", maxDurationSeconds: 90, recoverySessionId: null }
            : null,
    experience: parseExperienceSnapshot(aggregate.session.experienceSnapshot),
    wakeContext: aggregate.session.wakeContext,
    durationMinutes: aggregate.session.durationBudgetMinutes as 2 | 5 | 10,
    personalization: parseSnapshot(aggregate.session.personalizationSnapshot),
    status: aggregate.session.status,
    currentStepIndex: aggregate.session.currentStepIndex,
    version: aggregate.session.version,
    baseline:
      ratings.find(({ kind }) => kind === "baseline")?.value ??
      (aggregate.session.sessionKind === "recovery"
        ? (sourceRatings.find(({ kind }) => kind === "post_protocol")?.value ?? null)
        : null),
    tasks: tasks.map((task) => ({
      stepIndex: task.protocolStepIndex,
      taskId: task.taskId as TaskId,
      category: task.category,
      correct: task.correct,
      total: task.total,
      durationMs: task.durationMs,
      completionSource: task.completionSource === "timer" ? "timer" : "manual",
      ...(task.difficultyLevel === null ? {} : { difficultyLevel: task.difficultyLevel }),
      observedAt: task.observedAt.toISOString(),
    })),
    postRating: ratings.find(({ kind }) => kind === "post_protocol")?.value ?? null,
    followUp: followUps[0]?.outcome ?? null,
    startedAt: aggregate.session.startedAt?.toISOString() ?? null,
    protocolCompletedAt: aggregate.session.protocolCompletedAt?.toISOString() ?? null,
    followUpDueAt: aggregate.session.followUpDueAt?.toISOString() ?? null,
    abandonedAt: aggregate.session.abandonedAt?.toISOString() ?? null,
  };
  if (
    options.wakeLowEffectRecoveryEnabled &&
    session.sessionKind === "primary" &&
    !session.experience?.completedEarly &&
    session.status === "protocol_completed" &&
    session.baseline !== null &&
    session.postRating !== null &&
    session.postRating - session.baseline <= 1 &&
    session.recoveryOffer === null &&
    recoveryStepsFor(session, options).length > 0
  ) {
    session.recoveryOffer = {
      status: "eligible",
      maxDurationSeconds: 90,
      recoverySessionId: null,
    };
  }
  return session;
}

export async function canonicalForCommand(
  db: Database,
  userId: string,
  command: SessionCommand,
  options: SessionRepositoryOptions = DEFAULT_OPTIONS,
): Promise<WakeSession | null> {
  if (command.type !== "create") return loadSession(db, userId, command.sessionId, options);
  const [active] = await db
    .select({ id: wakeSessions.id })
    .from(wakeSessions)
    .where(
      and(
        eq(wakeSessions.userId, userId),
        inArray(wakeSessions.status, ["assigned", "in_progress"]),
      ),
    )
    .limit(1);
  return active ? loadSession(db, userId, active.id, options) : null;
}

export function recoveryStepsFor(
  primary: WakeSession,
  options: SessionRepositoryOptions,
): ProtocolStep[] {
  const profile: WakeCapabilityProfile = {
    movementLevel: primary.personalization.movementLevel,
    availableResources: primary.personalization.availableResources,
    excludedTaskIds: primary.personalization.excludedTaskIds,
    defaultDurationMinutes: primary.durationMinutes,
    onboardingCompleted: primary.personalization.fallbackReason !== "profile_missing",
    revision: primary.personalization.profileRevision,
  };
  return selectRecoverySteps({
    primarySteps: primary.effectiveSteps ?? primary.assignment.steps,
    completedTaskIds: primary.tasks.map(({ taskId }) => taskId),
    rejectedTaskIds: (primary.substitutions ?? []).flatMap((substitution) => [
      substitution.originalTaskId,
      ...(substitution.reason === "cannot_do" || substitution.reason === "not_helpful"
        ? [substitution.replacementTaskId]
        : []),
    ]),
    profile,
    catalog: {
      v9Enabled: options.wakeTaskCatalogV9Enabled && primary.assignment.protocolVersion >= 9,
    },
  });
}
