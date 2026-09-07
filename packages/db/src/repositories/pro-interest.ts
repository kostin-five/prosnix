import { and, count, eq } from "drizzle-orm";

import type { ProInterestRepository, ProInterestStatus } from "@awc/domain";
import { proInterestResponses, wakeSessions } from "../schema.js";
import type { Database } from "./types.js";

const OFFER_VERSION = "pro-interest-v1";
const REQUIRED_COMPLETED_SESSIONS = 7;

export class PostgresProInterestRepository implements ProInterestRepository {
  constructor(private readonly db: Database) {}

  private async completedSessions(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(wakeSessions)
      .where(and(eq(wakeSessions.userId, userId), eq(wakeSessions.status, "protocol_completed")));
    return Number(result?.count ?? 0);
  }

  async status(userId: string): Promise<ProInterestStatus> {
    const [completedSessions, submission] = await Promise.all([
      this.completedSessions(userId),
      this.db
        .select({ id: proInterestResponses.id })
        .from(proInterestResponses)
        .where(
          and(
            eq(proInterestResponses.userId, userId),
            eq(proInterestResponses.offerVersion, OFFER_VERSION),
          ),
        )
        .limit(1),
    ]);
    return {
      eligible: completedSessions >= REQUIRED_COMPLETED_SESSIONS,
      submitted: Boolean(submission[0]),
    };
  }

  async submit(input: Parameters<ProInterestRepository["submit"]>[0]): Promise<ProInterestStatus> {
    const current = await this.status(input.userId);
    if (!current.eligible || current.submitted) return current;
    await this.db
      .insert(proInterestResponses)
      .values({
        userId: input.userId,
        offerVersion: OFFER_VERSION,
        intent: input.intent,
        interestFocus: input.intent === "interested" ? input.interestFocus : null,
        createdAt: input.now,
      })
      .onConflictDoNothing();
    return this.status(input.userId);
  }
}
