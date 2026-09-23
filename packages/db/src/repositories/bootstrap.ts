import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";

import type { BootstrapRepository, BootstrapSession, ProtocolStep, TaskId } from "@awc/domain";
import { categoryForTask, SAFE_WAKE_PROFILE } from "@awc/domain";
import type { Database } from "./types.js";
import {
  experimentAssignments,
  followUpObservations,
  protocolDefinitions,
  ratingObservations,
  users,
  wakeSessions,
  wakeSchedules,
  wakeCapabilityProfiles,
  wakeRoutines,
  sessionTaskSubstitutions,
} from "../schema.js";

export class PostgresBootstrapRepository implements BootstrapRepository {
  constructor(private readonly db: Database) {}

  async load(userId: string, now = new Date()) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.deletionRequestedAt) return null;
    const [wakeSchedule, profile, routine] = await Promise.all([
      this.db
        .select()
        .from(wakeSchedules)
        .where(eq(wakeSchedules.userId, userId))
        .limit(1)
        .then((rows) => rows[0]),
      this.db
        .select()
        .from(wakeCapabilityProfiles)
        .where(eq(wakeCapabilityProfiles.userId, userId))
        .limit(1)
        .then((rows) => rows[0]),
      this.db
        .select()
        .from(wakeRoutines)
        .where(eq(wakeRoutines.userId, userId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    const [active] = await this.db
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
      .where(
        and(
          eq(wakeSessions.userId, userId),
          inArray(wakeSessions.status, ["assigned", "in_progress"]),
        ),
      )
      .limit(1);

    let activeSession: BootstrapSession | null = null;
    if (active) {
      const [ratings, substitutions] = await Promise.all([
        this.db
          .select({ kind: ratingObservations.kind, value: ratingObservations.value })
          .from(ratingObservations)
          .where(eq(ratingObservations.sessionId, active.session.id)),
        this.db
          .select()
          .from(sessionTaskSubstitutions)
          .where(eq(sessionTaskSubstitutions.sessionId, active.session.id))
          .orderBy(asc(sessionTaskSubstitutions.createdAt), asc(sessionTaskSubstitutions.id)),
      ]);
      const assignedSteps = Array.isArray(active.protocol.steps)
        ? (active.protocol.steps as ProtocolStep[])
        : [];
      const effectiveSteps = assignedSteps.map((step) => ({ ...step }));
      for (const substitution of substitutions) {
        if (!effectiveSteps[substitution.stepIndex]) continue;
        effectiveSteps[substitution.stepIndex] = {
          index: substitution.stepIndex,
          taskId: substitution.replacementTaskId as TaskId,
          category: categoryForTask(substitution.replacementTaskId as TaskId),
        };
      }
      activeSession = {
        session: {
          id: active.session.id,
          userId: active.session.userId,
          assignmentId: active.session.assignmentId,
          status: active.session.status,
          currentStepIndex: active.session.currentStepIndex,
          version: active.session.version,
          wakeContext: active.session.wakeContext,
          durationMinutes: active.session.durationBudgetMinutes as 2 | 5 | 10,
          personalization:
            typeof active.session.personalizationSnapshot === "object" &&
            active.session.personalizationSnapshot !== null
              ? (active.session
                  .personalizationSnapshot as BootstrapSession["session"]["personalization"])
              : {
                  profileRevision: SAFE_WAKE_PROFILE.revision,
                  movementLevel: SAFE_WAKE_PROFILE.movementLevel,
                  availableResources: [],
                  excludedTaskIds: [],
                  fallbackReason: "profile_missing",
                },
          sessionKind: active.session.sessionKind,
          parentSessionId: active.session.parentSessionId,
          recoveryBaseline:
            active.session.baselineSourceSessionId &&
            active.session.baselineSourceRatingKind === "post_protocol"
              ? {
                  sessionId: active.session.baselineSourceSessionId,
                  ratingKind: "post_protocol",
                }
              : null,
          experience:
            typeof active.session.experienceSnapshot === "object" &&
            active.session.experienceSnapshot !== null
              ? (active.session.experienceSnapshot as import("@awc/domain").WakeExperienceSnapshot)
              : { soundMode: "unknown" },
          startedAt: active.session.startedAt,
          protocolCompletedAt: active.session.protocolCompletedAt,
          followUpDueAt: active.session.followUpDueAt,
          abandonedAt: active.session.abandonedAt,
        },
        protocol: {
          key: active.protocol.protocolKey,
          version: active.protocol.version,
          title: active.protocol.title,
          steps: assignedSteps,
          effectiveSteps,
        },
        assignment: {
          strategyVersion: active.assignment.strategyVersion,
          phase: active.assignment.phase,
          hypothesis: active.assignment.hypothesis,
        },
        baseline: ratings.find(({ kind }) => kind === "baseline")?.value ?? null,
        postRating: ratings.find(({ kind }) => kind === "post_protocol")?.value ?? null,
        substitutions: substitutions.map((substitution) => ({
          id: substitution.id,
          sessionId: substitution.sessionId,
          stepIndex: substitution.stepIndex,
          originalTaskId: substitution.originalTaskId as TaskId,
          replacementTaskId: substitution.replacementTaskId as TaskId,
          reason: substitution.reason,
          operationId: substitution.operationId,
          createdAt: substitution.createdAt,
        })),
      };
    }

    const [dueFollowUp] = await this.db
      .select({ id: wakeSessions.id })
      .from(wakeSessions)
      .leftJoin(followUpObservations, eq(followUpObservations.sessionId, wakeSessions.id))
      .where(
        and(
          eq(wakeSessions.userId, userId),
          eq(wakeSessions.status, "protocol_completed"),
          lte(wakeSessions.followUpDueAt, now),
          isNull(followUpObservations.id),
        ),
      )
      .orderBy(asc(wakeSessions.followUpDueAt))
      .limit(1);

    return {
      user: {
        id: user.id,
        telegramUserId: user.telegramUserId,
        locale: user.locale,
        timezone: user.timezone,
        deletionRequestedAt: user.deletionRequestedAt,
      },
      activeSession,
      dueFollowUpSessionId: dueFollowUp?.id ?? null,
      wakeSchedule: wakeSchedule
        ? {
            userId: wakeSchedule.userId,
            localTime: wakeSchedule.localTime,
            timezone: wakeSchedule.timezone,
            enabled: wakeSchedule.enabled,
            nextTriggerAt: wakeSchedule.nextTriggerAt,
            botStatus: wakeSchedule.botStatus,
            revision: wakeSchedule.revision,
          }
        : null,
      wakeProfile: profile
        ? {
            movementLevel: profile.movementLevel,
            availableResources: profile.availableResources as import("@awc/domain").WakeResource[],
            excludedTaskIds: profile.excludedTaskIds as import("@awc/domain").TaskId[],
            defaultDurationMinutes: profile.defaultDurationMinutes as 2 | 5 | 10,
            onboardingCompleted: profile.onboardingCompletedAt !== null,
            revision: profile.revision,
          }
        : SAFE_WAKE_PROFILE,
      wakeRoutine: routine
        ? {
            enabled: routine.enabled,
            items: routine.items as import("@awc/domain").WakeRoutineItem[],
            revision: routine.revision,
          }
        : { enabled: false, items: [], revision: 0 },
    };
  }
}
