import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import {
  abandonSession,
  acceptBaseline,
  acceptFollowUp,
  acceptPostRating,
  acceptTaskResult,
  HANDS_FREE_ORDER,
  learningAssignmentCandidates,
  selectHandsFreeAssignment,
  selectPersonalizedAssignment,
  selectTaskSubstitution,
  SessionCommandConflict,
  SessionCommandError,
  type AdaptiveProtocolEvidence,
  type SessionCommand,
  type SessionCommandEnvelope,
  type SessionCommandRepository,
  type SessionCommandResult,
  type TaskId,
  type WakeCapabilityProfile,
  type WakeSession,
} from "@awc/domain";
import {
  experimentAssignments,
  followUpObservations,
  idempotencyRecords,
  protocolDefinitions,
  ratingObservations,
  sessionTaskSubstitutions,
  taskObservations,
  users,
  wakeCapabilityProfiles,
  wakeSessions,
} from "../schema.js";
import type { Database } from "./types.js";

import {
  canonicalForCommand,
  DEFAULT_OPTIONS,
  loadSession,
  mapProfile,
  parseExperienceSnapshot,
  recoveryStepsFor,
  type SessionRepositoryOptions,
} from "./session-reader.js";

async function createSession(
  db: Database,
  envelope: SessionCommandEnvelope,
  options: SessionRepositoryOptions,
): Promise<{ session: WakeSession; responseStatus: 200 | 201 }> {
  const existing = await canonicalForCommand(db, envelope.userId, envelope.command, options);
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
  const [completedRows, previousAssignments] = await Promise.all([
    db
      .select({
        sessionId: wakeSessions.id,
        steps: protocolDefinitions.steps,
        wakeContext: wakeSessions.wakeContext,
        durationMinutes: wakeSessions.durationBudgetMinutes,
        completedAt: wakeSessions.protocolCompletedAt,
        experienceSnapshot: wakeSessions.experienceSnapshot,
        sessionKind: wakeSessions.sessionKind,
      })
      .from(wakeSessions)
      .innerJoin(experimentAssignments, eq(wakeSessions.assignmentId, experimentAssignments.id))
      .innerJoin(
        protocolDefinitions,
        eq(experimentAssignments.protocolDefinitionId, protocolDefinitions.id),
      )
      .where(
        and(
          eq(wakeSessions.userId, envelope.userId),
          eq(wakeSessions.status, "protocol_completed"),
        ),
      )
      .orderBy(desc(wakeSessions.protocolCompletedAt))
      .limit(100),
    db
      .select({
        steps: protocolDefinitions.steps,
        experienceSnapshot: wakeSessions.experienceSnapshot,
      })
      .from(wakeSessions)
      .innerJoin(experimentAssignments, eq(wakeSessions.assignmentId, experimentAssignments.id))
      .innerJoin(
        protocolDefinitions,
        eq(experimentAssignments.protocolDefinitionId, protocolDefinitions.id),
      )
      .where(eq(wakeSessions.userId, envelope.userId))
      .orderBy(desc(wakeSessions.createdAt))
      .limit(100),
  ]);
  const mode = envelope.command.interactionMode === "hands_free" ? "hands_free" : "manual";
  const previous = previousAssignments.find(
    (row) => parseExperienceSnapshot(row.experienceSnapshot).interactionMode === mode,
  );
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
  const completedIds = completedRows.map(({ sessionId }) => sessionId);
  const [completedRatings, completedFollowUps, completedTasks] =
    completedIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          db
            .select({
              sessionId: ratingObservations.sessionId,
              kind: ratingObservations.kind,
              value: ratingObservations.value,
            })
            .from(ratingObservations)
            .where(inArray(ratingObservations.sessionId, completedIds)),
          db
            .select({
              sessionId: followUpObservations.sessionId,
              outcome: followUpObservations.outcome,
            })
            .from(followUpObservations)
            .where(inArray(followUpObservations.sessionId, completedIds)),
          db
            .select({
              sessionId: taskObservations.sessionId,
              stepIndex: taskObservations.protocolStepIndex,
              taskId: taskObservations.taskId,
            })
            .from(taskObservations)
            .where(inArray(taskObservations.sessionId, completedIds))
            .orderBy(asc(taskObservations.protocolStepIndex)),
        ]);
  const adaptiveEvidence: AdaptiveProtocolEvidence[] = completedRows.flatMap((row) => {
    if (
      parseExperienceSnapshot(row.experienceSnapshot).completedEarly ||
      row.sessionKind !== "primary" ||
      parseExperienceSnapshot(row.experienceSnapshot).interactionMode !== mode
    )
      return [];
    const baseline = completedRatings.find(
      (rating) => rating.sessionId === row.sessionId && rating.kind === "baseline",
    )?.value;
    const postRating = completedRatings.find(
      (rating) => rating.sessionId === row.sessionId && rating.kind === "post_protocol",
    )?.value;
    if (baseline === undefined || postRating === undefined || !Array.isArray(row.steps)) return [];
    const actualTaskIds = completedTasks
      .filter((task) => task.sessionId === row.sessionId)
      .map(({ taskId }) => taskId);
    const sequenceKey = (
      actualTaskIds.length > 0
        ? actualTaskIds
        : row.steps.flatMap((step) =>
            typeof step === "object" &&
            step !== null &&
            "taskId" in step &&
            typeof step.taskId === "string"
              ? [step.taskId]
              : [],
          )
    ).join(">");
    if (!sequenceKey) return [];
    return [
      {
        sequenceKey,
        wakeContext: row.wakeContext,
        durationMinutes: row.durationMinutes as 2 | 5 | 10,
        baseline,
        postRating,
        followUp:
          completedFollowUps.find(({ sessionId }) => sessionId === row.sessionId)?.outcome ?? null,
        ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {}),
      },
    ];
  });
  const [profileRow] = await db
    .select()
    .from(wakeCapabilityProfiles)
    .where(eq(wakeCapabilityProfiles.userId, envelope.userId))
    .limit(1);
  const profile = mapProfile(profileRow);
  const personalized =
    envelope.command.interactionMode === "hands_free"
      ? selectHandsFreeAssignment(
          profile,
          envelope.command.durationMinutes,
          {
            v9Enabled: options.wakeTaskCatalogV9Enabled,
          },
          {
            evidence: adaptiveEvidence,
            wakeContext: envelope.command.wakeContext,
            completedSessions: adaptiveEvidence.length,
          },
          previousTaskIds,
        )
      : selectPersonalizedAssignment(
          learningAssignmentCandidates(user.learningSessionCount).map((candidate) => ({
            ...candidate,
            id: "pending",
          })),
          profile,
          envelope.command.durationMinutes,
          previousTaskIds,
          {
            evidence: adaptiveEvidence,
            wakeContext: envelope.command.wakeContext,
            completedSessions: user.learningSessionCount,
          },
          { v9Enabled: options.wakeTaskCatalogV9Enabled },
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
      experienceSnapshot: {
        soundMode: "unknown",
        interactionMode:
          envelope.command.interactionMode === "hands_free" ? "hands_free" : "manual",
      },
    })
    .returning({ id: wakeSessions.id });
  if (!row) throw new Error("Не удалось создать wake-сессию");
  const session = await loadSession(db, envelope.userId, row.id, options);
  if (!session) throw new Error("Созданная wake-сессия не найдена");
  return { session, responseStatus: 201 };
}

async function createRecoverySession(
  db: Database,
  envelope: SessionCommandEnvelope & {
    command: Extract<SessionCommand, { type: "start_recovery" }>;
  },
  options: SessionRepositoryOptions,
): Promise<{ session: WakeSession; responseStatus: 201 }> {
  const primary = await loadSession(db, envelope.userId, envelope.command.sessionId, options);
  const unavailable = () =>
    new SessionCommandConflict(
      "recovery_unavailable",
      "Дополнительный раунд для этой сессии недоступен",
      primary,
    );
  if (
    !primary ||
    primary.version !== envelope.command.expectedVersion ||
    primary.sessionKind === "recovery"
  ) {
    if (primary && primary.version !== envelope.command.expectedVersion) {
      throw new SessionCommandConflict(
        "stale_version",
        "Состояние сессии уже изменилось на другом устройстве",
        primary,
      );
    }
    throw unavailable();
  }
  if (
    primary.status !== "protocol_completed" ||
    primary.experience?.completedEarly === true ||
    primary.baseline === null ||
    primary.postRating === null ||
    primary.postRating - primary.baseline > 1 ||
    primary.recoveryOffer?.status === "accepted" ||
    primary.recoveryOffer?.status === "declined"
  ) {
    throw unavailable();
  }
  const steps = recoveryStepsFor(primary, options);
  if (steps.length === 0) throw unavailable();

  const protocolKey = `recovery-${steps.map(({ taskId }) => taskId).join("-")}`;
  const insertedProtocol = await db
    .insert(protocolDefinitions)
    .values({
      protocolKey,
      version: 1,
      title: "Короткий дополнительный раунд",
      steps,
    })
    .onConflictDoNothing()
    .returning({ id: protocolDefinitions.id });
  const existingProtocol = insertedProtocol[0]
    ? undefined
    : (
        await db
          .select({ id: protocolDefinitions.id })
          .from(protocolDefinitions)
          .where(
            and(
              eq(protocolDefinitions.protocolKey, protocolKey),
              eq(protocolDefinitions.version, 1),
            ),
          )
          .limit(1)
      )[0];
  const protocolId = insertedProtocol[0]?.id ?? existingProtocol?.id;
  if (!protocolId) throw new Error("Не удалось получить recovery-протокол");

  const [assignment] = await db
    .insert(experimentAssignments)
    .values({
      userId: envelope.userId,
      protocolDefinitionId: protocolId,
      strategyVersion: "recovery-v1",
      phase: "fallback",
      hypothesis: "Проверяем короткое продолжение после слабого изменения бодрости",
      evidenceSnapshot: {
        parentSessionId: primary.id,
        baselineSource: "primary_post_rating",
      },
    })
    .returning({ id: experimentAssignments.id });
  if (!assignment) throw new Error("Не удалось создать recovery-назначение");

  const updatedPrimary = await db
    .update(wakeSessions)
    .set({
      version: primary.version + 1,
      followUpDueAt: null,
      updatedAt: envelope.observedAt,
    })
    .where(
      and(
        eq(wakeSessions.id, primary.id),
        eq(wakeSessions.userId, envelope.userId),
        eq(wakeSessions.version, primary.version),
      ),
    )
    .returning({ id: wakeSessions.id });
  if (!updatedPrimary[0]) {
    throw new SessionCommandConflict(
      "stale_version",
      "Состояние сессии уже изменилось на другом устройстве",
      await loadSession(db, envelope.userId, primary.id, options),
    );
  }

  const [row] = await db
    .insert(wakeSessions)
    .values({
      userId: envelope.userId,
      assignmentId: assignment.id,
      status: "in_progress",
      currentStepIndex: 0,
      version: 1,
      wakeContext: primary.wakeContext,
      durationBudgetMinutes: 2,
      personalizationSnapshot: primary.personalization,
      experienceSnapshot: primary.experience ?? { soundMode: "unknown" },
      sessionKind: "recovery",
      parentSessionId: primary.id,
      baselineSourceSessionId: primary.id,
      baselineSourceRatingKind: "post_protocol",
      startedAt: envelope.observedAt,
    })
    .returning({ id: wakeSessions.id });
  if (!row) throw new Error("Не удалось создать recovery-сессию");
  const recovery = await loadSession(db, envelope.userId, row.id, options);
  if (!recovery) throw new Error("Созданная recovery-сессия не найдена");
  return { session: recovery, responseStatus: 201 };
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
      experienceSnapshot: next.experience ?? previous.experience ?? { soundMode: "unknown" },
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
  options: SessionRepositoryOptions,
): Promise<{ session: WakeSession; responseStatus: 200 }> {
  const command = envelope.command;
  if (command.type === "create") throw new Error("Unexpected create mutation");
  const current = await loadSession(db, envelope.userId, command.sessionId, options);
  if (!current) throw new SessionCommandConflict("session_not_found", "Сессия не найдена", null);
  const observedAt = envelope.observedAt.toISOString();

  try {
    let next: WakeSession;
    if (command.type === "baseline") {
      next = {
        ...acceptBaseline(current, {
          expectedVersion: command.expectedVersion,
          value: command.value,
          observedAt,
        }),
        experience: {
          soundMode: command.experience?.soundMode ?? current.experience?.soundMode ?? "unknown",
          interactionMode: current.experience?.interactionMode ?? "manual",
        },
      };
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
    } else if (command.type === "substitute") {
      if (current.version !== command.expectedVersion) {
        throw new SessionCommandConflict(
          "stale_version",
          "Состояние сессии уже изменилось на другом устройстве",
          current,
        );
      }
      if (current.status !== "in_progress" || current.baseline === null) {
        throw new SessionCommandConflict(
          "invalid_transition",
          "Задание можно заменить только во время активного протокола",
          current,
        );
      }
      const effectiveSteps = [...(current.effectiveSteps ?? current.assignment.steps)];
      const originalStep = effectiveSteps[command.stepIndex];
      const profile: WakeCapabilityProfile = {
        movementLevel: current.personalization.movementLevel,
        availableResources: current.personalization.availableResources,
        excludedTaskIds: current.personalization.excludedTaskIds,
        defaultDurationMinutes: current.durationMinutes,
        onboardingCompleted: current.personalization.fallbackReason !== "profile_missing",
        revision: current.personalization.profileRevision,
      };
      const selection = selectTaskSubstitution({
        steps: effectiveSteps,
        targetIndex: command.stepIndex,
        currentStepIndex: current.currentStepIndex,
        completedTaskIds: current.tasks.map(({ taskId }) => taskId),
        rejectedTaskIds: (current.substitutions ?? []).flatMap((substitution) => [
          substitution.originalTaskId,
          substitution.replacementTaskId,
        ]),
        profile,
        durationMinutes: current.durationMinutes,
        protocolVersion: current.assignment.protocolVersion,
        ...(current.assignment.comparison?.factorKey
          ? { comparisonFactorKey: current.assignment.comparison.factorKey }
          : {}),
        catalog: {
          v9Enabled: options.wakeTaskCatalogV9Enabled && current.assignment.protocolVersion >= 9,
        },
        ...(current.experience?.interactionMode === "hands_free"
          ? { allowedTaskIds: HANDS_FREE_ORDER }
          : {}),
        reason: command.reason,
      });
      if (!originalStep || !selection) {
        throw new SessionCommandConflict(
          "no_alternative",
          "Для этого шага сейчас нет новой безопасной альтернативы",
          current,
        );
      }
      const [inserted] = await db
        .insert(sessionTaskSubstitutions)
        .values({
          userId: envelope.userId,
          sessionId: current.id,
          stepIndex: command.stepIndex,
          originalTaskId: originalStep.taskId,
          replacementTaskId: selection.replacementTaskId,
          reason: command.reason,
          operationId: envelope.operationId,
          createdAt: envelope.observedAt,
        })
        .returning();
      if (!inserted) throw new Error("Замена задания не была сохранена");
      effectiveSteps[command.stepIndex] = {
        index: command.stepIndex,
        taskId: selection.replacementTaskId,
        category: selection.category,
      };
      next = {
        ...current,
        effectiveSteps,
        substitutions: [
          ...(current.substitutions ?? []),
          {
            id: inserted.id,
            stepIndex: inserted.stepIndex,
            originalTaskId: inserted.originalTaskId as TaskId,
            replacementTaskId: inserted.replacementTaskId as TaskId,
            reason: inserted.reason,
            operationId: inserted.operationId,
            createdAt: inserted.createdAt.toISOString(),
          },
        ],
        version: current.version + 1,
      };
      await updateSnapshot(db, current, next, envelope.observedAt);
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
        completionSource: observation.completionSource ?? "manual",
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
        ...(command.completionReason ? { completionReason: command.completionReason } : {}),
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
      if (current.sessionKind !== "recovery" && !next.experience?.completedEarly) {
        await db
          .update(users)
          .set({
            learningSessionCount: sql`${users.learningSessionCount} + 1`,
            updatedAt: envelope.observedAt,
          })
          .where(eq(users.id, envelope.userId));
      }
      if (
        options.wakeLowEffectRecoveryEnabled &&
        !next.experience?.completedEarly &&
        current.sessionKind !== "recovery" &&
        current.baseline !== null &&
        command.value - current.baseline <= 1 &&
        recoveryStepsFor(next, options).length > 0
      ) {
        next = {
          ...next,
          recoveryOffer: {
            status: "eligible",
            maxDurationSeconds: 90,
            recoverySessionId: null,
          },
        };
      }
    } else if (command.type === "decline_recovery") {
      if (
        current.version !== command.expectedVersion ||
        current.sessionKind === "recovery" ||
        current.status !== "protocol_completed" ||
        current.baseline === null ||
        current.postRating === null ||
        current.postRating - current.baseline > 1 ||
        current.recoveryOffer?.status === "accepted" ||
        current.recoveryOffer?.status === "declined" ||
        recoveryStepsFor(current, options).length === 0
      ) {
        if (current.version !== command.expectedVersion) {
          throw new SessionCommandConflict(
            "stale_version",
            "Состояние сессии уже изменилось на другом устройстве",
            current,
          );
        }
        throw new SessionCommandConflict(
          "recovery_unavailable",
          "Дополнительный раунд для этой сессии недоступен",
          current,
        );
      }
      next = {
        ...current,
        version: current.version + 1,
        recoveryOffer: {
          status: "declined",
          maxDurationSeconds: 90,
          recoverySessionId: null,
        },
      };
      const rows = await db
        .update(wakeSessions)
        .set({
          version: next.version,
          recoveryOfferDeclinedAt: envelope.observedAt,
          updatedAt: envelope.observedAt,
        })
        .where(
          and(
            eq(wakeSessions.id, current.id),
            eq(wakeSessions.userId, current.userId),
            eq(wakeSessions.version, current.version),
          ),
        )
        .returning({ id: wakeSessions.id });
      if (!rows[0]) {
        throw new SessionCommandConflict(
          "stale_version",
          "Состояние сессии уже изменилось на другом устройстве",
          await loadSession(db, current.userId, current.id, options),
        );
      }
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
      if (current.sessionKind === "recovery") {
        next = {
          ...next,
          followUpDueAt: new Date(envelope.observedAt.getTime() + 15 * 60_000).toISOString(),
        };
      }
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
  private readonly options: SessionRepositoryOptions;

  constructor(
    private readonly db: Database,
    options: Partial<SessionRepositoryOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

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
            await canonicalForCommand(db, envelope.userId, envelope.command, this.options),
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
          ? await createSession(db, envelope, this.options)
          : envelope.command.type === "start_recovery"
            ? await createRecoverySession(
                db,
                envelope as SessionCommandEnvelope & {
                  command: Extract<SessionCommand, { type: "start_recovery" }>;
                },
                this.options,
              )
            : await mutateSession(db, envelope, this.options);
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
