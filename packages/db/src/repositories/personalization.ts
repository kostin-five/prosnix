import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import {
  PersonalizationConflict,
  SAFE_WAKE_PROFILE,
  type TaskId,
  type WakeCapabilityProfile,
  type WakeResource,
  type WakeRoutine,
  type WakeRoutineItem,
  type WakeRoutineRun,
  type WakePersonalizationRepository,
} from "@awc/domain";
import {
  idempotencyRecords,
  userLifeGoals,
  wakeCapabilityProfiles,
  wakeRoutineRuns,
  wakeRoutines,
  wakeSessions,
} from "../schema.js";
import type { Database } from "./types.js";

const RESOURCE_IDS = new Set<WakeResource>([
  "water",
  "bright_light",
  "floor_space",
  "wash_access",
  "active_movement",
]);
const TASK_IDS = new Set<TaskId>([
  "math",
  "memory",
  "stroop",
  "reaction",
  "steps",
  "squats",
  "shake",
  "water",
  "window",
  "curtains",
  "sit_edge",
  "cool_wash",
  "pushups",
]);

function stringArray<T extends string>(value: unknown, allowed?: ReadonlySet<T>): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is T =>
      typeof item === "string" && (allowed === undefined || allowed.has(item as T)),
  );
}

function routineItems(value: unknown): WakeRoutineItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const candidate = item as Record<string, unknown>;
    return typeof candidate.id === "string" && typeof candidate.title === "string"
      ? [{ id: candidate.id, title: candidate.title }]
      : [];
  });
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function mapProfile(row: typeof wakeCapabilityProfiles.$inferSelect): WakeCapabilityProfile {
  return {
    movementLevel: row.movementLevel,
    availableResources: stringArray(row.availableResources, RESOURCE_IDS),
    excludedTaskIds: stringArray(row.excludedTaskIds, TASK_IDS),
    defaultDurationMinutes: row.defaultDurationMinutes as 2 | 5 | 10,
    onboardingCompleted: row.onboardingCompletedAt !== null,
    revision: row.revision,
  };
}

function mapRoutine(row: typeof wakeRoutines.$inferSelect): WakeRoutine {
  return { enabled: row.enabled, items: routineItems(row.items), revision: row.revision };
}

function mapRun(row: typeof wakeRoutineRuns.$inferSelect): WakeRoutineRun {
  return {
    sessionId: row.sessionId,
    items: routineItems(row.itemsSnapshot),
    completedItemIds: stringArray(row.completedItemIds),
    revision: row.revision,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

async function replay<T>(
  db: Database,
  userId: string,
  operationId: string,
  requestHash: string,
): Promise<T | null> {
  const [stored] = await db
    .select()
    .from(idempotencyRecords)
    .where(
      and(eq(idempotencyRecords.userId, userId), eq(idempotencyRecords.operationId, operationId)),
    )
    .limit(1);
  if (!stored) return null;
  if (stored.requestHash !== requestHash) {
    throw new PersonalizationConflict(
      "idempotency_conflict",
      "Ключ операции уже использован с другими данными",
    );
  }
  return stored.responseBody as T;
}

async function remember(
  db: Database,
  input: {
    userId: string;
    operationId: string;
    commandType: string;
    requestHash: string;
    responseBody: unknown;
    now: Date;
  },
): Promise<void> {
  await db.insert(idempotencyRecords).values({
    userId: input.userId,
    operationId: input.operationId,
    commandType: input.commandType,
    requestHash: input.requestHash,
    responseStatus: 200,
    responseBody: input.responseBody,
    expiresAt: new Date(input.now.getTime() + 30 * 24 * 60 * 60_000),
  });
}

export class PostgresWakePersonalizationRepository implements WakePersonalizationRepository {
  constructor(private readonly db: Database) {}

  async loadLifeGoal(userId: string): Promise<{ text: string; revision: number }> {
    const [row] = await this.db
      .select({ text: userLifeGoals.text, revision: userLifeGoals.revision })
      .from(userLifeGoals)
      .where(eq(userLifeGoals.userId, userId))
      .limit(1);
    return row ?? { text: "", revision: 0 };
  }

  saveLifeGoal(
    input: Parameters<WakePersonalizationRepository["saveLifeGoal"]>[0],
  ): Promise<{ text: string; revision: number }> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.userId}, 0))`);
      const requestHash = hash({
        type: "life_goal",
        text: input.text,
        expectedRevision: input.expectedRevision,
      });
      const replayed = await replay<{ text: string; revision: number }>(
        db,
        input.userId,
        input.operationId,
        requestHash,
      );
      if (replayed) return replayed;
      const [current] = await db
        .select({ revision: userLifeGoals.revision })
        .from(userLifeGoals)
        .where(eq(userLifeGoals.userId, input.userId))
        .limit(1);
      if ((current?.revision ?? 0) !== input.expectedRevision)
        throw new PersonalizationConflict("stale_version", "Цель уже изменена");
      const revision = input.expectedRevision + 1;
      const [saved] = await db
        .insert(userLifeGoals)
        .values({ userId: input.userId, text: input.text, revision, updatedAt: input.now })
        .onConflictDoUpdate({
          target: userLifeGoals.userId,
          set: { text: input.text, revision, updatedAt: input.now },
        })
        .returning({ text: userLifeGoals.text, revision: userLifeGoals.revision });
      if (!saved) throw new Error("Life goal save returned no row");
      await remember(db, {
        ...input,
        commandType: "life_goal",
        requestHash,
        responseBody: saved,
      });
      return saved;
    });
  }

  async loadProfile(userId: string): Promise<WakeCapabilityProfile> {
    const [row] = await this.db
      .select()
      .from(wakeCapabilityProfiles)
      .where(eq(wakeCapabilityProfiles.userId, userId))
      .limit(1);
    return row ? mapProfile(row) : SAFE_WAKE_PROFILE;
  }

  saveProfile(
    input: Parameters<WakePersonalizationRepository["saveProfile"]>[0],
  ): Promise<WakeCapabilityProfile> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.userId}, 0))`);
      const requestHash = hash({
        type: "wake_profile",
        profile: input.profile,
        expectedRevision: input.expectedRevision,
      });
      const replayed = await replay<WakeCapabilityProfile>(
        db,
        input.userId,
        input.operationId,
        requestHash,
      );
      if (replayed) return replayed;
      const [current] = await db
        .select()
        .from(wakeCapabilityProfiles)
        .where(eq(wakeCapabilityProfiles.userId, input.userId))
        .limit(1);
      if ((current?.revision ?? 0) !== input.expectedRevision)
        throw new PersonalizationConflict("stale_version", "Профиль уже изменён");
      const revision = input.expectedRevision + 1;
      const [saved] = await db
        .insert(wakeCapabilityProfiles)
        .values({
          userId: input.userId,
          movementLevel: input.profile.movementLevel,
          availableResources: input.profile.availableResources,
          excludedTaskIds: input.profile.excludedTaskIds,
          defaultDurationMinutes: input.profile.defaultDurationMinutes,
          onboardingCompletedAt: input.profile.onboardingCompleted ? input.now : null,
          revision,
          updatedAt: input.now,
        })
        .onConflictDoUpdate({
          target: wakeCapabilityProfiles.userId,
          set: {
            movementLevel: input.profile.movementLevel,
            availableResources: input.profile.availableResources,
            excludedTaskIds: input.profile.excludedTaskIds,
            defaultDurationMinutes: input.profile.defaultDurationMinutes,
            onboardingCompletedAt: input.profile.onboardingCompleted ? input.now : null,
            revision,
            updatedAt: input.now,
          },
        })
        .returning();
      if (!saved) throw new Error("Wake profile save returned no row");
      const result = mapProfile(saved);
      await remember(db, {
        ...input,
        commandType: "wake_profile",
        requestHash,
        responseBody: result,
      });
      return result;
    });
  }

  async loadRoutine(userId: string): Promise<WakeRoutine> {
    const [row] = await this.db
      .select()
      .from(wakeRoutines)
      .where(eq(wakeRoutines.userId, userId))
      .limit(1);
    return row ? mapRoutine(row) : { enabled: false, items: [], revision: 0 };
  }

  async loadRoutineRun(userId: string, sessionId: string): Promise<WakeRoutineRun | null> {
    const [row] = await this.db
      .select()
      .from(wakeRoutineRuns)
      .where(and(eq(wakeRoutineRuns.userId, userId), eq(wakeRoutineRuns.sessionId, sessionId)))
      .limit(1);
    return row ? mapRun(row) : null;
  }

  saveRoutine(
    input: Parameters<WakePersonalizationRepository["saveRoutine"]>[0],
  ): Promise<WakeRoutine> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.userId}, 0))`);
      const requestHash = hash({
        type: "wake_routine",
        routine: input.routine,
        expectedRevision: input.expectedRevision,
      });
      const replayed = await replay<WakeRoutine>(db, input.userId, input.operationId, requestHash);
      if (replayed) return replayed;
      const [current] = await db
        .select()
        .from(wakeRoutines)
        .where(eq(wakeRoutines.userId, input.userId))
        .limit(1);
      if ((current?.revision ?? 0) !== input.expectedRevision)
        throw new PersonalizationConflict("stale_version", "Рутина уже изменена");
      const revision = input.expectedRevision + 1;
      const [saved] = await db
        .insert(wakeRoutines)
        .values({ userId: input.userId, ...input.routine, revision, updatedAt: input.now })
        .onConflictDoUpdate({
          target: wakeRoutines.userId,
          set: { ...input.routine, revision, updatedAt: input.now },
        })
        .returning();
      if (!saved) throw new Error("Wake routine save returned no row");
      const result = mapRoutine(saved);
      await remember(db, {
        ...input,
        commandType: "wake_routine",
        requestHash,
        responseBody: result,
      });
      return result;
    });
  }

  saveRoutineRun(
    input: Parameters<WakePersonalizationRepository["saveRoutineRun"]>[0],
  ): Promise<WakeRoutineRun> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.userId}, 0))`);
      const requestHash = hash({
        type: "wake_routine_run",
        sessionId: input.sessionId,
        completedItemIds: input.completedItemIds,
        expectedRevision: input.expectedRevision,
      });
      const replayed = await replay<WakeRoutineRun>(
        db,
        input.userId,
        input.operationId,
        requestHash,
      );
      if (replayed) return replayed;
      const [session] = await db
        .select()
        .from(wakeSessions)
        .where(and(eq(wakeSessions.id, input.sessionId), eq(wakeSessions.userId, input.userId)))
        .limit(1);
      if (!session) throw new PersonalizationConflict("session_not_found", "Сессия не найдена");
      if (session.status !== "protocol_completed")
        throw new PersonalizationConflict(
          "invalid_state",
          "Рутина доступна после завершения протокола",
        );
      const [current, routine] = await Promise.all([
        db
          .select()
          .from(wakeRoutineRuns)
          .where(eq(wakeRoutineRuns.sessionId, input.sessionId))
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select()
          .from(wakeRoutines)
          .where(eq(wakeRoutines.userId, input.userId))
          .limit(1)
          .then((rows) => rows[0]),
      ]);
      if ((current?.revision ?? 0) !== input.expectedRevision)
        throw new PersonalizationConflict("stale_version", "Прогресс рутины уже изменён");
      const items = current
        ? routineItems(current.itemsSnapshot)
        : routineItems(routine?.items ?? []);
      const allowedIds = new Set(items.map(({ id }) => id));
      if (input.completedItemIds.some((id) => !allowedIds.has(id)))
        throw new PersonalizationConflict("invalid_state", "Неизвестный пункт рутины");
      const revision = input.expectedRevision + 1;
      const completedAt =
        items.length > 0 && input.completedItemIds.length === items.length ? input.now : null;
      const [saved] = await db
        .insert(wakeRoutineRuns)
        .values({
          sessionId: input.sessionId,
          userId: input.userId,
          itemsSnapshot: items,
          completedItemIds: input.completedItemIds,
          revision,
          completedAt,
          updatedAt: input.now,
        })
        .onConflictDoUpdate({
          target: wakeRoutineRuns.sessionId,
          set: {
            completedItemIds: input.completedItemIds,
            revision,
            completedAt,
            updatedAt: input.now,
          },
        })
        .returning();
      if (!saved) throw new Error("Wake routine run save returned no row");
      const result = mapRun(saved);
      await remember(db, {
        ...input,
        commandType: "wake_routine_run",
        requestHash,
        responseBody: result,
      });
      return result;
    });
  }
}
