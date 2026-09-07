import { and, count, eq } from "drizzle-orm";

import type { ExperimentFeedbackRepository, ExperimentFeedbackStatus } from "@awc/domain";
import { experimentFeedback, wakeSessions } from "../schema.js";
import type { Database } from "./types.js";

const FEEDBACK_EXPERIMENT_VERSION = "feedback-v1";
const REQUIRED_COMPLETED_SESSIONS = 5;

export class PostgresExperimentFeedbackRepository implements ExperimentFeedbackRepository {
  constructor(private readonly db: Database) {}

  private async completedSessions(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(wakeSessions)
      .where(and(eq(wakeSessions.userId, userId), eq(wakeSessions.status, "protocol_completed")));
    return Number(result?.count ?? 0);
  }

  async status(userId: string): Promise<ExperimentFeedbackStatus> {
    const [completedSessions, submission] = await Promise.all([
      this.completedSessions(userId),
      this.db
        .select({ userId: experimentFeedback.userId })
        .from(experimentFeedback)
        .where(
          and(
            eq(experimentFeedback.userId, userId),
            eq(experimentFeedback.experimentVersion, FEEDBACK_EXPERIMENT_VERSION),
          ),
        )
        .limit(1),
    ]);
    return {
      eligible: completedSessions >= REQUIRED_COMPLETED_SESSIONS,
      submitted: Boolean(submission[0]),
    };
  }

  async submit(input: Parameters<ExperimentFeedbackRepository["submit"]>[0]) {
    const current = await this.status(input.userId);
    if (!current.eligible || current.submitted) return current;
    await this.db
      .insert(experimentFeedback)
      .values({
        userId: input.userId,
        experimentVersion: FEEDBACK_EXPERIMENT_VERSION,
        helpful: input.helpful,
        irritating: input.irritating,
        continueIntent: input.continueIntent,
        createdAt: input.now,
      })
      .onConflictDoNothing();
    return this.status(input.userId);
  }
}
