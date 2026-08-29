import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";

import type { BootstrapRepository, BootstrapSession } from "@awc/domain";
import type { Database } from "./types.js";
import {
  experimentAssignments,
  followUpObservations,
  protocolDefinitions,
  ratingObservations,
  users,
  wakeSessions,
  wakeSchedules,
} from "../schema.js";

export class PostgresBootstrapRepository implements BootstrapRepository {
  constructor(private readonly db: Database) {}

  async load(userId: string, now = new Date()) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.deletionRequestedAt) return null;
    const [wakeSchedule] = await this.db
      .select()
      .from(wakeSchedules)
      .where(eq(wakeSchedules.userId, userId))
      .limit(1);

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
      const ratings = await this.db
        .select({ kind: ratingObservations.kind, value: ratingObservations.value })
        .from(ratingObservations)
        .where(eq(ratingObservations.sessionId, active.session.id));
      activeSession = {
        session: {
          id: active.session.id,
          userId: active.session.userId,
          assignmentId: active.session.assignmentId,
          status: active.session.status,
          currentStepIndex: active.session.currentStepIndex,
          version: active.session.version,
          startedAt: active.session.startedAt,
          protocolCompletedAt: active.session.protocolCompletedAt,
          followUpDueAt: active.session.followUpDueAt,
          abandonedAt: active.session.abandonedAt,
        },
        protocol: {
          key: active.protocol.protocolKey,
          version: active.protocol.version,
          title: active.protocol.title,
          steps: active.protocol.steps,
        },
        assignment: {
          strategyVersion: active.assignment.strategyVersion,
          phase: active.assignment.phase,
          hypothesis: active.assignment.hypothesis,
        },
        baseline: ratings.find(({ kind }) => kind === "baseline")?.value ?? null,
        postRating: ratings.find(({ kind }) => kind === "post_protocol")?.value ?? null,
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
    };
  }
}
