import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type {
  IdempotencyRepository,
  Repositories,
  SessionRecord,
  SessionRepository,
  UnitOfWork,
  UserRecord,
  UserRepository,
} from "@awc/domain";
import * as schema from "../schema.js";
import type { Database } from "./types.js";

export { PostgresBootstrapRepository } from "./bootstrap.js";
export { PostgresSessionCommandRepository } from "./sessions.js";
export { PostgresAnalyticsRepository } from "./analytics.js";
export { PostgresUserDeletionRepository } from "./delete-user.js";
export { PostgresFollowUpNotificationRepository } from "./follow-up-notifications.js";
export { PostgresNotificationMaintenanceRepository } from "./notification-maintenance.js";
export {
  PostgresWakeNotificationRepository,
  PostgresWakeScheduleRepository,
} from "./wake-schedules.js";

function mapUser(row: typeof schema.users.$inferSelect): UserRecord {
  return {
    id: row.id,
    telegramUserId: row.telegramUserId,
    locale: row.locale,
    timezone: row.timezone,
    deletionRequestedAt: row.deletionRequestedAt,
  };
}

function mapSession(row: typeof schema.wakeSessions.$inferSelect): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    assignmentId: row.assignmentId,
    status: row.status,
    currentStepIndex: row.currentStepIndex,
    version: row.version,
    startedAt: row.startedAt,
    protocolCompletedAt: row.protocolCompletedAt,
    followUpDueAt: row.followUpDueAt,
    abandonedAt: row.abandonedAt,
  };
}

class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findByTelegramId(telegramUserId: bigint): Promise<UserRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.telegramUserId, telegramUserId))
      .limit(1);
    return row ? mapUser(row) : null;
  }

  async createFromTelegram(input: {
    telegramUserId: bigint;
    locale?: string;
  }): Promise<UserRecord> {
    const [row] = await this.db
      .insert(schema.users)
      .values(input)
      .onConflictDoUpdate({
        target: schema.users.telegramUserId,
        set: {
          ...(input.locale ? { locale: input.locale } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error("User insert did not return a row");
    return mapUser(row);
  }
}

class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async findActiveForUser(userId: string): Promise<SessionRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.wakeSessions)
      .where(
        and(
          eq(schema.wakeSessions.userId, userId),
          inArray(schema.wakeSessions.status, ["assigned", "in_progress"]),
        ),
      )
      .limit(1);
    return row ? mapSession(row) : null;
  }

  async findOwnedById(userId: string, sessionId: string): Promise<SessionRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.wakeSessions)
      .where(and(eq(schema.wakeSessions.userId, userId), eq(schema.wakeSessions.id, sessionId)))
      .limit(1);
    return row ? mapSession(row) : null;
  }

  async updateState(
    input: Parameters<SessionRepository["updateState"]>[0],
  ): Promise<SessionRecord | null> {
    const [row] = await this.db
      .update(schema.wakeSessions)
      .set({
        status: input.status,
        currentStepIndex: input.currentStepIndex,
        version: input.expectedVersion + 1,
        updatedAt: new Date(),
        ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
        ...(input.protocolCompletedAt !== undefined
          ? { protocolCompletedAt: input.protocolCompletedAt }
          : {}),
        ...(input.followUpDueAt !== undefined ? { followUpDueAt: input.followUpDueAt } : {}),
        ...(input.abandonedAt !== undefined ? { abandonedAt: input.abandonedAt } : {}),
      })
      .where(
        and(
          eq(schema.wakeSessions.userId, input.userId),
          eq(schema.wakeSessions.id, input.sessionId),
          eq(schema.wakeSessions.version, input.expectedVersion),
        ),
      )
      .returning();
    return row ? mapSession(row) : null;
  }
}

class PostgresIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly db: Database) {}

  async find(userId: string, operationId: string) {
    const [row] = await this.db
      .select()
      .from(schema.idempotencyRecords)
      .where(
        and(
          eq(schema.idempotencyRecords.userId, userId),
          eq(schema.idempotencyRecords.operationId, operationId),
        ),
      )
      .limit(1);
    return row
      ? {
          requestHash: row.requestHash,
          responseStatus: row.responseStatus,
          responseBody: row.responseBody,
        }
      : null;
  }

  async save(input: Parameters<IdempotencyRepository["save"]>[0]): Promise<void> {
    await this.db.insert(schema.idempotencyRecords).values(input);
  }
}

export function createRepositories(db: Database): Repositories {
  return {
    users: new PostgresUserRepository(db),
    sessions: new PostgresSessionRepository(db),
    idempotency: new PostgresIdempotencyRepository(db),
  };
}

export function connectDatabase(databaseUrl: string): {
  db: Database;
  close: () => Promise<void>;
  unitOfWork: UnitOfWork;
} {
  const client = postgres(databaseUrl, { max: 10 });
  const db = drizzle(client, { schema });
  return {
    db,
    close: () => client.end(),
    unitOfWork: {
      transaction: (work) =>
        db.transaction((transaction) => work(createRepositories(transaction as Database))),
    },
  };
}
