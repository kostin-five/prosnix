import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import {
  SessionCommandConflict,
  SessionCommandError,
  abandonSession,
  acceptBaseline,
  acceptFollowUp,
  acceptPostRating,
  acceptTaskResult,
  learningAssignmentCandidates,
  SAFE_WAKE_PROFILE,
  selectPersonalizedAssignment,
  type ExperimentAssignment,
  type ProtocolStep,
  type SessionCommand,
  type SessionCommandEnvelope,
  type SessionCommandRepository,
  type SessionCommandResult,
  type TaskCategory,
  type TaskId,
  type WakeSession,
  type WakeCapabilityProfile,
  type WakePersonalizationSnapshot,
} from "@awc/domain";
import {
  experimentAssignments,
  followUpObservations,
  idempotencyRecords,
  protocolDefinitions,
  ratingObservations,
  taskObservations,
  users,
  wakeSessions,
  wakeCapabilityProfiles,
} from "../schema.js";
import type { Database } from "./types.js";

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
]);
const CATEGORIES = new Set<TaskCategory>(["cognitive", "movement", "behavioral", "environment"]);
function parseSteps(value: unknown): readonly ProtocolStep[] {
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

function parseSnapshot(value: unknown): WakePersonalizationSnapshot {
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
          (resource): resource is "water" | "bright_light" | "floor_space" =>
            resource === "water" || resource === "bright_light" || resource === "floor_space",
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

function mapProfile(
  row: typeof wakeCapabilityProfiles.$inferSelect | undefined,
): WakeCapabilityProfile {
  if (!row) return SAFE_WAKE_PROFILE;
  return {
    movementLevel: row.movementLevel,
    availableResources: Array.isArray(row.availableResources)
      ? row.availableResources.filter(
          (resource): resource is "water" | "bright_light" | "floor_space" =>
            resource === "water" || resource === "bright_light" || resource === "floor_space",
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

async function loadSession(
  db: Database,
  userId: string,
  sessionId: string,
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

  const [ratings, tasks, followUps] = await Promise.all([
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

  return {
    id: aggregate.session.id,
    userId: aggregate.session.userId,
    assignment: {
      id: aggregate.assignment.id,
      protocolKey: aggregate.protocol.protocolKey,
      protocolVersion: aggregate.protocol.version,
      strategyVersion: aggregate.assignment.strategyVersion,
      phase: aggregate.assignment.phase,
      hypothesis: aggregate.assignment.hypothesis,
      steps: parseSteps(aggregate.protocol.steps),
      ...(comparison ? { comparison } : {}),
    },
    wakeContext: aggregate.session.wakeContext,
    durationMinutes: aggregate.session.durationBudgetMinutes as 2 | 5 | 10,
    personalization: parseSnapshot(aggregate.session.personalizationSnapshot),
    status: aggregate.session.status,
    currentStepIndex: aggregate.session.currentStepIndex,
    version: aggregate.session.version,
    baseline: ratings.find(({ kind }) => kind === "baseline")?.value ?? null,
    tasks: tasks.map((task) => ({
      stepIndex: task.protocolStepIndex,
      taskId: task.taskId as TaskId,
      category: task.category,
      correct: task.correct,
      total: task.total,
      durationMs: task.durationMs,
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
}

async function canonicalForCommand(
  db: Database,
  userId: string,
  command: SessionCommand,
): Promise<WakeSession | null> {
  if (command.type !== "create") return loadSession(db, userId, command.sessionId);
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
  return active ? loadSession(db, userId, active.id) : null;
}

async function createSession(
  db: Database,
  envelope: SessionCommandEnvelope,
): Promise<{ session: WakeSession; responseStatus: 200 | 201 }> {
  const existing = await canonicalForCommand(db, envelope.userId, envelope.command);
  if (existing) return { session: existing, responseStatus: 200 };
  if (envelope.command.type !== "create") {
    throw new SessionCommandConflict("session_not_found", "Сессия не найдена", null);
  }
  const [user] = await db
    .select({ learningSessionCount: users.learningSessionCount })
    .from(users)
    .where(eq(users.id, envelope.userId))
    .limit(1);
  if (!user) throw new SessionCommandConflict("session_not_found", "Профиль не найден", null);
  const [previous] = await db
    .select({ steps: protocolDefinitions.steps })
    .from(wakeSessions)
    .innerJoin(experimentAssignments, eq(wakeSessions.assignmentId, experimentAssignments.id))
    .innerJoin(
      protocolDefinitions,
      eq(experimentAssignments.protocolDefinitionId, protocolDefinitions.id),
    )
    .where(
      and(eq(wakeSessions.userId, envelope.userId), eq(wakeSessions.status, "protocol_completed")),
    )
    .orderBy(desc(wakeSessions.protocolCompletedAt))
    .limit(1);
  const previousTaskIds = Array.isArray(previous?.steps)
    ? previous.steps.flatMap((step) =>
        typeof step === "object" &&
        step !== null &&
        "taskId" in step &&
        typeof step.taskId === "string"
          ? [step.taskId as TaskId]
          : [],
      )
    : [];
  const [profileRow] = await db
    .select()
    .from(wakeCapabilityProfiles)
    .where(eq(wakeCapabilityProfiles.userId, envelope.userId))
    .limit(1);
  const profile = mapProfile(profileRow);
  const personalized = selectPersonalizedAssignment(
    learningAssignmentCandidates(user.learningSessionCount).map((candidate) => ({
      ...candidate,
      id: "pending",
    })),
    profile,
    envelope.command.durationMinutes,
    previousTaskIds,
  );
  const planned = personalized.assignment;
  await db
    .update(users)
    .set({
      timezone: envelope.command.timezone,
      updatedAt: envelope.observedAt,
    })
    .where(eq(users.id, envelope.userId));

  const inserted = await db
    .insert(protocolDefinitions)
    .values({
      protocolKey: planned.protocolKey,
      version: planned.protocolVersion,
      title: planned.hypothesis,
      steps: planned.steps,
    })
    .onConflictDoNothing()
    .returning({ id: protocolDefinitions.id });
  const existingProtocol = inserted[0]
    ? undefined
    : (
        await db
          .select({ id: protocolDefinitions.id })
          .from(protocolDefinitions)
          .where(
            and(
              eq(protocolDefinitions.protocolKey, planned.protocolKey),
              eq(protocolDefinitions.version, planned.protocolVersion),
            ),
          )
          .limit(1)
      )[0];
  const protocolId = inserted[0]?.id ?? existingProtocol?.id;
  if (!protocolId) throw new Error("Не удалось получить стартовый протокол");

  const [assignment] = await db
    .insert(experimentAssignments)
    .values({
      userId: envelope.userId,
      protocolDefinitionId: protocolId,
      strategyVersion: planned.strategyVersion,
      phase: planned.phase,
      hypothesis: planned.hypothesis,
      evaluatedFactor: planned.comparison?.factorKey,
      comparisonGroupKey: planned.comparison?.groupKey,
      comparisonLevel: planned.comparison?.level,
      evidenceSnapshot: {
        wakeContext: envelope.command.wakeContext,
        durationMinutes: envelope.command.durationMinutes,
        personalization: personalized.snapshot,
      },
    })
    .returning({ id: experimentAssignments.id });
  if (!assignment) throw new Error("Не удалось создать назначение эксперимента");
  const [row] = await db
    .insert(wakeSessions)
    .values({
      userId: envelope.userId,
      assignmentId: assignment.id,
      wakeContext: envelope.command.wakeContext,
      durationBudgetMinutes: envelope.command.durationMinutes,
      personalizationSnapshot: personalized.snapshot,
    })
    .returning({ id: wakeSessions.id });
  if (!row) throw new Error("Не удалось создать wake-сессию");
  const session = await loadSession(db, envelope.userId, row.id);
  if (!session) throw new Error("Созданная wake-сессия не найдена");
  return { session, responseStatus: 201 };
}

async function updateSnapshot(
  db: Database,
  previous: WakeSession,
  next: WakeSession,
  observedAt: Date,
): Promise<void> {
  const rows = await db
    .update(wakeSessions)
    .set({
      status: next.status,
      currentStepIndex: next.currentStepIndex,
      version: next.version,
      startedAt: next.startedAt ? new Date(next.startedAt) : null,
      protocolCompletedAt: next.protocolCompletedAt ? new Date(next.protocolCompletedAt) : null,
      followUpDueAt: next.followUpDueAt ? new Date(next.followUpDueAt) : null,
      abandonedAt: next.abandonedAt ? new Date(next.abandonedAt) : null,
      updatedAt: observedAt,
    })
    .where(
      and(
        eq(wakeSessions.id, previous.id),
        eq(wakeSessions.userId, previous.userId),
        eq(wakeSessions.version, previous.version),
      ),
    )
    .returning({ id: wakeSessions.id });
  if (!rows[0]) {
    throw new SessionCommandConflict(
      "stale_version",
      "Состояние сессии уже изменилось на другом устройстве",
      await loadSession(db, previous.userId, previous.id),
    );
  }
}

async function mutateSession(
  db: Database,
  envelope: SessionCommandEnvelope,
): Promise<{ session: WakeSession; responseStatus: 200 }> {
  const command = envelope.command;
  if (command.type === "create") throw new Error("Unexpected create mutation");
  const current = await loadSession(db, envelope.userId, command.sessionId);
  if (!current) throw new SessionCommandConflict("session_not_found", "Сессия не найдена", null);
  const observedAt = envelope.observedAt.toISOString();

  try {
    let next: WakeSession;
    if (command.type === "baseline") {
      next = acceptBaseline(current, {
        expectedVersion: command.expectedVersion,
        value: command.value,
        observedAt,
      });
      await updateSnapshot(db, current, next, envelope.observedAt);
      await db.insert(ratingObservations).values({
        userId: envelope.userId,
        sessionId: current.id,
        kind: "baseline",
        value: command.value,
        observedAt: envelope.observedAt,
        ...(command.clientObservedAt
          ? { clientObservedAt: new Date(command.clientObservedAt) }
          : {}),
        operationId: envelope.operationId,
      });
    } else if (command.type === "task") {
      next = acceptTaskResult(current, { ...command, observedAt });
      await updateSnapshot(db, current, next, envelope.observedAt);
      const observation = next.tasks.at(-1);
      if (!observation) throw new Error("Task transition produced no observation");
      await db.insert(taskObservations).values({
        userId: envelope.userId,
        sessionId: current.id,
        protocolStepIndex: observation.stepIndex,
        taskId: observation.taskId,
        category: observation.category,
        correct: observation.correct,
        total: observation.total,
        durationMs: observation.durationMs,
        difficultyLevel: observation.difficultyLevel ?? null,
        observedAt: envelope.observedAt,
        operationId: envelope.operationId,
      });
    } else if (command.type === "post_rating") {
      next = acceptPostRating(current, {
        expectedVersion: command.expectedVersion,
        value: command.value,
        observedAt,
        followUpDelayMinutes: 15,
      });
      await updateSnapshot(db, current, next, envelope.observedAt);
      await db.insert(ratingObservations).values({
        userId: envelope.userId,
        sessionId: current.id,
        kind: "post_protocol",
        value: command.value,
        observedAt: envelope.observedAt,
        ...(command.clientObservedAt
          ? { clientObservedAt: new Date(command.clientObservedAt) }
          : {}),
        operationId: envelope.operationId,
      });
      await db
        .update(users)
        .set({
          learningSessionCount: sql`${users.learningSessionCount} + 1`,
          updatedAt: envelope.observedAt,
        })
        .where(eq(users.id, envelope.userId));
    } else if (command.type === "follow_up") {
      next = acceptFollowUp(current, {
        expectedVersion: command.expectedVersion ?? current.version,
        outcome: command.outcome,
      });
      await updateSnapshot(db, current, next, envelope.observedAt);
      const completedAt = current.protocolCompletedAt
        ? new Date(current.protocolCompletedAt).getTime()
        : envelope.observedAt.getTime();
      await db.insert(followUpObservations).values({
        userId: envelope.userId,
        sessionId: current.id,
        outcome: command.outcome,
        observedAt: envelope.observedAt,
        minutesAfterCompletion: Math.max(
          0,
          Math.floor((envelope.observedAt.getTime() - completedAt) / 60_000),
        ),
        operationId: envelope.operationId,
      });
    } else {
      next = abandonSession(current, { expectedVersion: command.expectedVersion, observedAt });
      await updateSnapshot(db, current, next, envelope.observedAt);
    }
    return { session: next, responseStatus: 200 };
  } catch (error) {
    if (error instanceof SessionCommandError) {
      throw new SessionCommandConflict(
        error.code === "stale_version" ? "stale_version" : "invalid_transition",
        error.message,
        current,
      );
    }
    throw error;
  }
}

export class PostgresSessionCommandRepository implements SessionCommandRepository {
  constructor(private readonly db: Database) {}

  execute(envelope: SessionCommandEnvelope): Promise<SessionCommandResult> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${envelope.userId}, 0))`);

      const [stored] = await db
        .select()
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.userId, envelope.userId),
            eq(idempotencyRecords.operationId, envelope.operationId),
          ),
        )
        .limit(1);
      if (stored) {
        if (stored.requestHash !== envelope.requestHash) {
          throw new SessionCommandConflict(
            "idempotency_conflict",
            "Ключ операции уже использован с другими данными",
            await canonicalForCommand(db, envelope.userId, envelope.command),
          );
        }
        return {
          session: stored.responseBody as WakeSession,
          responseStatus: stored.responseStatus === 201 ? 201 : 200,
          replayed: true,
        };
      }

      const accepted =
        envelope.command.type === "create"
          ? await createSession(db, envelope)
          : await mutateSession(db, envelope);
      await db.insert(idempotencyRecords).values({
        userId: envelope.userId,
        operationId: envelope.operationId,
        commandType: envelope.command.type,
        requestHash: envelope.requestHash,
        responseStatus: accepted.responseStatus,
        responseBody: accepted.session,
        expiresAt: new Date(envelope.observedAt.getTime() + 30 * 24 * 60 * 60_000),
      });
      return { ...accepted, replayed: false };
    });
  }
}
