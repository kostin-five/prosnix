import { and, asc, eq, sql } from "drizzle-orm";

import {
  SessionTaskSubstitutionConflict,
  type SessionTaskSubstitutionRecord,
  type SessionTaskSubstitutionRepository,
} from "@awc/domain";
import { idempotencyRecords, sessionTaskSubstitutions, wakeSessions } from "../schema.js";
import type { Database } from "./types.js";

function mapRecord(
  row: typeof sessionTaskSubstitutions.$inferSelect,
): SessionTaskSubstitutionRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    stepIndex: row.stepIndex,
    originalTaskId: row.originalTaskId as SessionTaskSubstitutionRecord["originalTaskId"],
    replacementTaskId: row.replacementTaskId as SessionTaskSubstitutionRecord["replacementTaskId"],
    reason: row.reason,
    operationId: row.operationId,
    createdAt: row.createdAt,
  };
}

function parseStoredRecord(value: unknown): SessionTaskSubstitutionRecord {
  if (typeof value !== "object" || value === null) {
    throw new Error("Сохранённый ответ замены повреждён");
  }
  const record = value as Omit<SessionTaskSubstitutionRecord, "createdAt"> & {
    createdAt: string | Date;
  };
  return { ...record, createdAt: new Date(record.createdAt) };
}

export class PostgresSessionTaskSubstitutionRepository implements SessionTaskSubstitutionRepository {
  constructor(private readonly db: Database) {}

  async list(userId: string, sessionId: string): Promise<SessionTaskSubstitutionRecord[]> {
    const rows = await this.db
      .select({ substitution: sessionTaskSubstitutions })
      .from(sessionTaskSubstitutions)
      .innerJoin(
        wakeSessions,
        and(
          eq(sessionTaskSubstitutions.sessionId, wakeSessions.id),
          eq(sessionTaskSubstitutions.userId, wakeSessions.userId),
        ),
      )
      .where(and(eq(wakeSessions.userId, userId), eq(wakeSessions.id, sessionId)))
      .orderBy(asc(sessionTaskSubstitutions.createdAt), asc(sessionTaskSubstitutions.id));
    return rows.map(({ substitution }) => mapRecord(substitution));
  }

  append(
    input: Parameters<SessionTaskSubstitutionRepository["append"]>[0],
  ): Promise<SessionTaskSubstitutionRecord> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.userId}, 0))`);

      const [stored] = await db
        .select()
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.userId, input.userId),
            eq(idempotencyRecords.operationId, input.operationId),
          ),
        )
        .limit(1);
      if (stored) {
        if (
          stored.commandType !== "task_substitution" ||
          stored.requestHash !== input.requestHash
        ) {
          throw new SessionTaskSubstitutionConflict(
            "idempotency_conflict",
            "Ключ операции уже использован с другими данными",
          );
        }
        return parseStoredRecord(stored.responseBody);
      }

      const [owned] = await db
        .select({ id: wakeSessions.id })
        .from(wakeSessions)
        .where(and(eq(wakeSessions.id, input.sessionId), eq(wakeSessions.userId, input.userId)))
        .limit(1);
      if (!owned) {
        throw new SessionTaskSubstitutionConflict("session_not_found", "Сессия не найдена");
      }

      const [inserted] = await db
        .insert(sessionTaskSubstitutions)
        .values({
          userId: input.userId,
          sessionId: input.sessionId,
          stepIndex: input.stepIndex,
          originalTaskId: input.originalTaskId,
          replacementTaskId: input.replacementTaskId,
          reason: input.reason,
          operationId: input.operationId,
          createdAt: input.now,
        })
        .returning();
      if (!inserted) throw new Error("Замена задания не была сохранена");
      const record = mapRecord(inserted);
      await db.insert(idempotencyRecords).values({
        userId: input.userId,
        operationId: input.operationId,
        commandType: "task_substitution",
        requestHash: input.requestHash,
        responseStatus: 200,
        responseBody: { ...record, createdAt: record.createdAt.toISOString() },
        expiresAt: new Date(input.now.getTime() + 30 * 24 * 60 * 60_000),
      });
      return record;
    });
  }
}
