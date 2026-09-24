import { and, asc, eq, inArray } from "drizzle-orm";

import {
  computeAnalyticsProfile,
  isFactorComparisonPreserved,
  type AnalyticsProfile,
  type AnalyticsRepository,
  type CompletedSessionEvidence,
  type ExperimentAssignment,
  type Metric,
  type WakeDurationMinutes,
} from "@awc/domain";
import {
  analyticsProjections,
  experimentAssignments,
  followUpObservations,
  protocolDefinitions,
  ratingObservations,
  sessionTaskSubstitutions,
  taskObservations,
  wakeSessions,
  users,
} from "../schema.js";
import type { Database } from "./types.js";

function projectionRows(userId: string, profile: AnalyticsProfile, computedAt: Date) {
  const metrics: Array<{ metric: Metric; subjectKey: string }> = [
    { metric: profile.averageDelta, subjectKey: "profile" },
    { metric: profile.riseSuccess, subjectKey: "profile" },
    ...profile.protocolEffects.map((metric) => ({ metric, subjectKey: metric.key })),
    ...profile.factorEffects.map((metric) => ({ metric, subjectKey: metric.key })),
    ...profile.sequenceEffects.map((metric) => ({ metric, subjectKey: metric.key })),
  ];
  return metrics.map(({ metric, subjectKey }) => ({
    userId,
    metricKey: metric.key,
    subjectKey,
    methodVersion: profile.methodVersion,
    value: { number: metric.value },
    evidenceCount: metric.evidenceCount,
    evidenceIds: metric.evidenceIds,
    confidence: metric.confidence,
    computedAt,
  }));
}

export class PostgresAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly db: Database) {}

  recompute(userId: string, now = new Date()): Promise<AnalyticsProfile> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      const [[user], sessions] = await Promise.all([
        db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1),
        db
          .select({
            sessionId: wakeSessions.id,
            protocolKey: protocolDefinitions.protocolKey,
            protocolVersion: protocolDefinitions.version,
            evaluatedFactor: experimentAssignments.evaluatedFactor,
            comparisonGroupKey: experimentAssignments.comparisonGroupKey,
            comparisonLevel: experimentAssignments.comparisonLevel,
            wakeContext: wakeSessions.wakeContext,
            durationMinutes: wakeSessions.durationBudgetMinutes,
            completedAt: wakeSessions.protocolCompletedAt,
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
              eq(wakeSessions.status, "protocol_completed"),
              eq(wakeSessions.sessionKind, "primary"),
            ),
          ),
      ]);

      let evidence: CompletedSessionEvidence[] = [];
      if (sessions.length > 0) {
        const sessionIds = sessions.map(({ sessionId }) => sessionId);
        const [ratings, followUps, tasks, substitutions] = await Promise.all([
          db
            .select({
              sessionId: ratingObservations.sessionId,
              kind: ratingObservations.kind,
              value: ratingObservations.value,
            })
            .from(ratingObservations)
            .where(inArray(ratingObservations.sessionId, sessionIds)),
          db
            .select({
              sessionId: followUpObservations.sessionId,
              outcome: followUpObservations.outcome,
            })
            .from(followUpObservations)
            .where(inArray(followUpObservations.sessionId, sessionIds)),
          db
            .select({
              sessionId: taskObservations.sessionId,
              taskId: taskObservations.taskId,
              category: taskObservations.category,
            })
            .from(taskObservations)
            .where(inArray(taskObservations.sessionId, sessionIds))
            .orderBy(asc(taskObservations.protocolStepIndex)),
          db
            .select({ sessionId: sessionTaskSubstitutions.sessionId })
            .from(sessionTaskSubstitutions)
            .where(inArray(sessionTaskSubstitutions.sessionId, sessionIds)),
        ]);
        evidence = sessions.flatMap((session) => {
          const baseline = ratings.find(
            (rating) => rating.sessionId === session.sessionId && rating.kind === "baseline",
          )?.value;
          const postRating = ratings.find(
            (rating) => rating.sessionId === session.sessionId && rating.kind === "post_protocol",
          )?.value;
          if (baseline === undefined || postRating === undefined) return [];
          const sessionTasks = tasks.filter((task) => task.sessionId === session.sessionId);
          const hasSubstitution = substitutions.some(
            (substitution) => substitution.sessionId === session.sessionId,
          );
          const comparisonPreserved =
            session.evaluatedFactor &&
            (session.comparisonLevel === "with" || session.comparisonLevel === "without")
              ? isFactorComparisonPreserved({
                  factorKey: session.evaluatedFactor,
                  level: session.comparisonLevel,
                  actualCategories: sessionTasks.map(({ category }) => category),
                  hasSubstitution,
                })
              : true;
          const comparison: ExperimentAssignment["comparison"] =
            session.evaluatedFactor &&
            session.comparisonGroupKey &&
            (session.comparisonLevel === "with" || session.comparisonLevel === "without") &&
            comparisonPreserved
              ? {
                  factorKey: session.evaluatedFactor,
                  groupKey: `${session.comparisonGroupKey}:${session.wakeContext}:${session.durationMinutes}m`,
                  level: session.comparisonLevel as "with" | "without",
                }
              : undefined;
          return [
            {
              sessionId: session.sessionId,
              protocolKey: `${session.protocolKey}@${session.wakeContext}`,
              protocolVersion: session.protocolVersion,
              baseline,
              postRating,
              followUp:
                followUps.find(({ sessionId }) => sessionId === session.sessionId)?.outcome ?? null,
              sequenceKey: sessionTasks.map((task) => task.taskId).join(">"),
              wakeContext: session.wakeContext,
              durationMinutes: session.durationMinutes as WakeDurationMinutes,
              ...(session.completedAt ? { completedAt: session.completedAt.toISOString() } : {}),
              ...(comparison ? { comparison } : {}),
            },
          ];
        });
      }

      const profile = computeAnalyticsProfile(evidence, now.toISOString(), user?.timezone ?? "UTC");
      await db.delete(analyticsProjections).where(eq(analyticsProjections.userId, userId));
      await db.insert(analyticsProjections).values(projectionRows(userId, profile, now));
      return profile;
    });
  }
}
