import { and, eq, inArray } from "drizzle-orm";

import {
  computeAnalyticsProfile,
  type AnalyticsProfile,
  type AnalyticsRepository,
  type CompletedSessionEvidence,
  type ExperimentAssignment,
  type Metric,
} from "@awc/domain";
import {
  analyticsProjections,
  experimentAssignments,
  followUpObservations,
  protocolDefinitions,
  ratingObservations,
  wakeSessions,
} from "../schema.js";
import type { Database } from "./types.js";

function projectionRows(userId: string, profile: AnalyticsProfile, computedAt: Date) {
  const metrics: Array<{ metric: Metric; subjectKey: string }> = [
    { metric: profile.averageDelta, subjectKey: "profile" },
    { metric: profile.riseSuccess, subjectKey: "profile" },
    ...profile.protocolEffects.map((metric) => ({ metric, subjectKey: metric.key })),
    ...profile.factorEffects.map((metric) => ({ metric, subjectKey: metric.key })),
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
      const sessions = await db
        .select({
          sessionId: wakeSessions.id,
          protocolKey: protocolDefinitions.protocolKey,
          protocolVersion: protocolDefinitions.version,
          evaluatedFactor: experimentAssignments.evaluatedFactor,
          comparisonGroupKey: experimentAssignments.comparisonGroupKey,
          comparisonLevel: experimentAssignments.comparisonLevel,
        })
        .from(wakeSessions)
        .innerJoin(experimentAssignments, eq(wakeSessions.assignmentId, experimentAssignments.id))
        .innerJoin(
          protocolDefinitions,
          eq(experimentAssignments.protocolDefinitionId, protocolDefinitions.id),
        )
        .where(and(eq(wakeSessions.userId, userId), eq(wakeSessions.status, "protocol_completed")));

      let evidence: CompletedSessionEvidence[] = [];
      if (sessions.length > 0) {
        const sessionIds = sessions.map(({ sessionId }) => sessionId);
        const [ratings, followUps] = await Promise.all([
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
        ]);
        evidence = sessions.flatMap((session) => {
          const baseline = ratings.find(
            (rating) => rating.sessionId === session.sessionId && rating.kind === "baseline",
          )?.value;
          const postRating = ratings.find(
            (rating) => rating.sessionId === session.sessionId && rating.kind === "post_protocol",
          )?.value;
          if (baseline === undefined || postRating === undefined) return [];
          const comparison: ExperimentAssignment["comparison"] =
            session.evaluatedFactor &&
            session.comparisonGroupKey &&
            (session.comparisonLevel === "with" || session.comparisonLevel === "without")
              ? {
                  factorKey: session.evaluatedFactor,
                  groupKey: session.comparisonGroupKey,
                  level: session.comparisonLevel as "with" | "without",
                }
              : undefined;
          return [
            {
              sessionId: session.sessionId,
              protocolKey: session.protocolKey,
              protocolVersion: session.protocolVersion,
              baseline,
              postRating,
              followUp:
                followUps.find(({ sessionId }) => sessionId === session.sessionId)?.outcome ?? null,
              ...(comparison ? { comparison } : {}),
            },
          ];
        });
      }

      const profile = computeAnalyticsProfile(evidence, now.toISOString());
      await db.delete(analyticsProjections).where(eq(analyticsProjections.userId, userId));
      await db.insert(analyticsProjections).values(projectionRows(userId, profile, now));
      return profile;
    });
  }
}
