import { eq } from "drizzle-orm";

import type { CoachInsightRecord, CoachInsightRepository } from "@awc/domain";
import { coachInsights, users } from "../schema.js";
import type { Database } from "./types.js";

function map(row: typeof coachInsights.$inferSelect): CoachInsightRecord {
  return {
    userId: row.userId,
    evidenceFingerprint: row.evidenceFingerprint,
    summary: row.summary,
    nextExperiment: row.nextExperiment,
    caveat: row.caveat,
    model: row.model,
    evidenceCount: row.evidenceCount,
    generatedAt: row.generatedAt,
  };
}

export class PostgresCoachInsightRepository implements CoachInsightRepository {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: string): Promise<CoachInsightRecord | null> {
    const [row] = await this.db
      .select()
      .from(coachInsights)
      .where(eq(coachInsights.userId, userId))
      .limit(1);
    return row ? map(row) : null;
  }

  async findTimezoneByUserId(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.timezone ?? "UTC";
  }

  async save(record: CoachInsightRecord, now = new Date()): Promise<CoachInsightRecord> {
    const [row] = await this.db
      .insert(coachInsights)
      .values({ ...record, updatedAt: now })
      .onConflictDoUpdate({
        target: coachInsights.userId,
        set: {
          evidenceFingerprint: record.evidenceFingerprint,
          summary: record.summary,
          nextExperiment: record.nextExperiment,
          caveat: record.caveat,
          model: record.model,
          evidenceCount: record.evidenceCount,
          generatedAt: record.generatedAt,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new Error("Coach insight upsert did not return a row");
    return map(row);
  }
}
