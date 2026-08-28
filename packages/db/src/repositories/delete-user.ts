import { eq, sql } from "drizzle-orm";

import type { UserDeletionRepository } from "@awc/domain";
import { auditEvents, users } from "../schema.js";
import type { Database } from "./types.js";

export class PostgresUserDeletionRepository implements UserDeletionRepository {
  constructor(private readonly db: Database) {}

  deleteUser(userId: string, correlationId: string, now = new Date()): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      await db.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      await db
        .update(auditEvents)
        .set({ userId: null, aggregateId: null, metadata: { anonymized: true } })
        .where(eq(auditEvents.userId, userId));
      const deleted = await db
        .delete(users)
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      if (deleted.length === 0) return false;
      await db.insert(auditEvents).values({
        userId: null,
        eventType: "user_deleted",
        aggregateId: null,
        correlationId,
        metadata: { anonymized: true },
        createdAt: now,
      });
      return true;
    });
  }
}
