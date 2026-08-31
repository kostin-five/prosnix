import { eq } from "drizzle-orm";

import type { LegalAcceptanceRepository } from "@awc/domain";
import { legalAcceptances } from "../schema.js";
import type { Database } from "./types.js";

export class PostgresLegalAcceptanceRepository implements LegalAcceptanceRepository {
  constructor(private readonly db: Database) {}

  async find(userId: string) {
    const [row] = await this.db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.userId, userId))
      .limit(1);
    return row
      ? {
          privacyVersion: row.privacyVersion,
          termsVersion: row.termsVersion,
          acceptedAt: row.acceptedAt,
        }
      : null;
  }

  async accept(input: Parameters<LegalAcceptanceRepository["accept"]>[0]): Promise<void> {
    await this.db
      .insert(legalAcceptances)
      .values({ ...input, updatedAt: input.acceptedAt })
      .onConflictDoUpdate({
        target: legalAcceptances.userId,
        set: {
          privacyVersion: input.privacyVersion,
          termsVersion: input.termsVersion,
          acceptedAt: input.acceptedAt,
          updatedAt: input.acceptedAt,
        },
      });
  }
}
