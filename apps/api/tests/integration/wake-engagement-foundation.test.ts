import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresBootstrapRepository,
  PostgresSessionCommandRepository,
  PostgresSessionTaskSubstitutionRepository,
  PostgresUserDeletionRepository,
  sessionTaskSubstitutions,
  sql,
} from "@awc/db";
import type { TaskId } from "@awc/domain";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)(
  "PostgreSQL wake engagement foundation",
  () => {
    const database = connectDatabase(databaseUrl!);
    const telegramUserId = 910000009101n;
    const otherTelegramUserId = 910000009102n;
    const replacementTelegramUserId = 910000009103n;

    afterAll(async () => {
      const deletion = new PostgresUserDeletionRepository(database.db);
      const users = await database.unitOfWork.transaction(async ({ users }) =>
        Promise.all([
          users.findByTelegramId(telegramUserId),
          users.findByTelegramId(otherTelegramUserId),
          users.findByTelegramId(replacementTelegramUserId),
        ]),
      );
      await Promise.all(
        users
          .filter((user) => user !== null)
          .map((user, index) => deletion.deleteUser(user.id, `wake-engagement-cleanup-${index}`)),
      );
      await database.close();
    });

    it("восстанавливает effectiveSteps после versioned замены", async () => {
      const deletion = new PostgresUserDeletionRepository(database.db);
      const previous = await database.unitOfWork.transaction(({ users }) =>
        users.findByTelegramId(replacementTelegramUserId),
      );
      if (previous) await deletion.deleteUser(previous.id, "wake-replacement-reset");
      const user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId: replacementTelegramUserId, locale: "ru" }),
      );
      const commands = new PostgresSessionCommandRepository(database.db);
      const created = await commands.execute({
        userId: user.id,
        operationId: "replacement-create-0001",
        requestHash: "replacement-create-hash",
        observedAt: new Date("2026-09-23T06:00:00.000Z"),
        command: {
          type: "create",
          timezone: "Europe/Moscow",
          wakeContext: "night_sleep",
          durationMinutes: 2,
        },
      });
      const baseline = await commands.execute({
        userId: user.id,
        operationId: "replacement-baseline-0001",
        requestHash: "replacement-baseline-hash",
        observedAt: new Date("2026-09-23T06:00:10.000Z"),
        command: {
          type: "baseline",
          sessionId: created.session.id,
          expectedVersion: created.session.version,
          value: 3,
        },
      });
      const nextReplaced = await commands.execute({
        userId: user.id,
        operationId: "replacement-next-0001",
        requestHash: "replacement-next-hash",
        observedAt: new Date("2026-09-23T06:00:15.000Z"),
        command: {
          type: "substitute",
          sessionId: baseline.session.id,
          expectedVersion: baseline.session.version,
          stepIndex: baseline.session.currentStepIndex + 1,
          reason: "not_helpful",
        },
      });
      expect(nextReplaced.session.effectiveSteps?.[1]?.taskId).not.toBe(
        baseline.session.effectiveSteps?.[1]?.taskId,
      );
      expect(nextReplaced.session.substitutions).toHaveLength(1);

      const afterNextResume = await new PostgresBootstrapRepository(database.db).load(user.id);
      expect(afterNextResume?.activeSession?.protocol.effectiveSteps).toEqual(
        nextReplaced.session.effectiveSteps,
      );

      const currentReplaced = await commands.execute({
        userId: user.id,
        operationId: "replacement-current-0001",
        requestHash: "replacement-current-hash",
        observedAt: new Date("2026-09-23T06:00:20.000Z"),
        command: {
          type: "substitute",
          sessionId: baseline.session.id,
          expectedVersion: nextReplaced.session.version,
          stepIndex: baseline.session.currentStepIndex,
          reason: "cannot_do",
        },
      });
      expect(currentReplaced.session.effectiveSteps?.[0]?.taskId).not.toBe(
        baseline.session.effectiveSteps?.[0]?.taskId,
      );
      expect(currentReplaced.session.substitutions).toHaveLength(2);

      const resumed = await new PostgresBootstrapRepository(database.db).load(user.id);
      expect(resumed?.activeSession?.protocol.effectiveSteps).toEqual(
        currentReplaced.session.effectiveSteps,
      );
      expect(resumed?.activeSession?.substitutions).toHaveLength(2);
      await deletion.deleteUser(user.id, "wake-replacement-cleanup");
    });

    it("сохраняет sound snapshot и изолирует идемпотентные замены заданий по владельцу", async () => {
      const deletion = new PostgresUserDeletionRepository(database.db);
      const existing = await database.unitOfWork.transaction(async ({ users }) =>
        Promise.all([
          users.findByTelegramId(telegramUserId),
          users.findByTelegramId(otherTelegramUserId),
        ]),
      );
      for (const [index, user] of existing.entries()) {
        if (user) await deletion.deleteUser(user.id, `wake-engagement-reset-${index}`);
      }

      const [user, otherUser] = await database.unitOfWork.transaction(async ({ users }) =>
        Promise.all([
          users.createFromTelegram({ telegramUserId, locale: "ru" }),
          users.createFromTelegram({ telegramUserId: otherTelegramUserId, locale: "ru" }),
        ]),
      );
      const commands = new PostgresSessionCommandRepository(database.db);
      const created = await commands.execute({
        userId: user.id,
        operationId: "engagement-create-0001",
        requestHash: "engagement-create-hash",
        observedAt: new Date("2026-09-23T05:00:00.000Z"),
        command: {
          type: "create",
          timezone: "Europe/Moscow",
          wakeContext: "night_sleep",
          durationMinutes: 5,
        },
      });
      const baseline = await commands.execute({
        userId: user.id,
        operationId: "engagement-baseline-0001",
        requestHash: "engagement-baseline-hash",
        observedAt: new Date("2026-09-23T05:00:10.000Z"),
        command: {
          type: "baseline",
          sessionId: created.session.id,
          expectedVersion: created.session.version,
          value: 3,
          experience: { soundMode: "on" },
        },
      });
      expect(baseline.session.experience).toEqual({ soundMode: "on" });

      const firstStep = baseline.session.assignment.steps[0]!;
      const replacementTaskId: TaskId = firstStep.taskId === "math" ? "reaction" : "math";
      const substitutions = new PostgresSessionTaskSubstitutionRepository(database.db);
      const input = {
        userId: user.id,
        sessionId: baseline.session.id,
        stepIndex: 0,
        originalTaskId: firstStep.taskId,
        replacementTaskId,
        reason: "unwilling_now" as const,
        operationId: "engagement-substitution-0001",
        requestHash: "engagement-substitution-hash",
        now: new Date("2026-09-23T05:00:15.000Z"),
      };
      const stored = await substitutions.append(input);
      await expect(substitutions.append(input)).resolves.toEqual(stored);
      await expect(
        substitutions.append({ ...input, requestHash: "changed-substitution-hash" }),
      ).rejects.toMatchObject({ code: "idempotency_conflict" });
      await expect(
        substitutions.append({
          ...input,
          userId: otherUser.id,
          operationId: "engagement-substitution-other-user",
        }),
      ).rejects.toMatchObject({ code: "session_not_found" });
      expect(await substitutions.list(user.id, baseline.session.id)).toEqual([stored]);
      expect(await substitutions.list(otherUser.id, baseline.session.id)).toEqual([]);

      await expect(
        database.db.execute(sql`
        update wake_sessions
        set session_kind = 'recovery'
        where id = ${baseline.session.id}::uuid
      `),
      ).rejects.toThrow();

      await deletion.deleteUser(user.id, "wake-engagement-cascade");
      const orphaned = (await database.db.select().from(sessionTaskSubstitutions)).filter(
        (row) => row.sessionId === baseline.session.id,
      );
      expect(orphaned).toEqual([]);
      await deletion.deleteUser(otherUser.id, "wake-engagement-other-user");
    });
  },
);
