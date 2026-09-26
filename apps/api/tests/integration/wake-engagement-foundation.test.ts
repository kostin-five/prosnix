import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresAnalyticsRepository,
  PostgresBootstrapRepository,
  PostgresSessionCommandRepository,
  PostgresSessionHistoryRepository,
  PostgresSessionTaskSubstitutionRepository,
  PostgresUserDeletionRepository,
  sessionTaskSubstitutions,
  sql,
  users,
  wakeSessions,
} from "@awc/db";
import { estimatedTaskSeconds, taskSuccessTarget, type TaskId } from "@awc/domain";

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
    const recoveryTelegramUserId = 910000009104n;

    afterAll(async () => {
      const deletion = new PostgresUserDeletionRepository(database.db);
      const users = await database.unitOfWork.transaction(async ({ users }) =>
        Promise.all([
          users.findByTelegramId(telegramUserId),
          users.findByTelegramId(otherTelegramUserId),
          users.findByTelegramId(replacementTelegramUserId),
          users.findByTelegramId(recoveryTelegramUserId),
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

    it("сохраняет recovery как отдельный раунд и оставляет аналитику основного результата", async () => {
      const deletion = new PostgresUserDeletionRepository(database.db);
      const previous = await database.unitOfWork.transaction(({ users: userRepository }) =>
        userRepository.findByTelegramId(recoveryTelegramUserId),
      );
      if (previous) await deletion.deleteUser(previous.id, "wake-recovery-reset");
      const user = await database.unitOfWork.transaction(({ users: userRepository }) =>
        userRepository.createFromTelegram({ telegramUserId: recoveryTelegramUserId, locale: "ru" }),
      );
      const commands = new PostgresSessionCommandRepository(database.db, {
        wakeLowEffectRecoveryEnabled: true,
      });
      let current = (
        await commands.execute({
          userId: user.id,
          operationId: "recovery-create-0001",
          requestHash: "recovery-create-hash",
          observedAt: new Date("2026-09-24T06:00:00.000Z"),
          command: {
            type: "create",
            timezone: "Europe/Moscow",
            wakeContext: "night_sleep",
            durationMinutes: 2,
          },
        })
      ).session;
      current = (
        await commands.execute({
          userId: user.id,
          operationId: "recovery-baseline-0001",
          requestHash: "recovery-baseline-hash",
          observedAt: new Date("2026-09-24T06:00:05.000Z"),
          command: {
            type: "baseline",
            sessionId: current.id,
            expectedVersion: current.version,
            value: 3,
          },
        })
      ).session;
      for (const step of current.effectiveSteps ?? current.assignment.steps) {
        const target = taskSuccessTarget(
          step.taskId,
          current.durationMinutes,
          current.assignment.protocolVersion,
        );
        current = (
          await commands.execute({
            userId: user.id,
            operationId: `recovery-primary-task-${step.index}`,
            requestHash: `recovery-primary-task-hash-${step.index}`,
            observedAt: new Date(`2026-09-24T06:00:${10 + step.index}.000Z`),
            command: {
              type: "task",
              sessionId: current.id,
              expectedVersion: current.version,
              stepIndex: step.index,
              taskId: step.taskId,
              correct: target,
              total: target,
              durationMs: 1_000,
            },
          })
        ).session;
      }
      const primary = (
        await commands.execute({
          userId: user.id,
          operationId: "recovery-primary-post-0001",
          requestHash: "recovery-primary-post-hash",
          observedAt: new Date("2026-09-24T06:01:00.000Z"),
          command: {
            type: "post_rating",
            sessionId: current.id,
            expectedVersion: current.version,
            value: 4,
          },
        })
      ).session;
      expect(primary.recoveryOffer).toEqual({
        status: "eligible",
        maxDurationSeconds: 90,
        recoverySessionId: null,
      });

      const startEnvelope = {
        userId: user.id,
        operationId: "recovery-start-0001",
        requestHash: "recovery-start-hash",
        observedAt: new Date("2026-09-24T06:01:05.000Z"),
        command: {
          type: "start_recovery" as const,
          sessionId: primary.id,
          expectedVersion: primary.version,
        },
      };
      const started = await commands.execute(startEnvelope);
      expect(started.responseStatus).toBe(201);
      expect((await commands.execute(startEnvelope)).session.id).toBe(started.session.id);
      expect(started.session).toMatchObject({
        sessionKind: "recovery",
        parentSessionId: primary.id,
        baseline: 4,
        recoveryBaseline: { sessionId: primary.id, ratingKind: "post_protocol" },
      });
      const recoverySteps = started.session.effectiveSteps ?? started.session.assignment.steps;
      expect(recoverySteps.length).toBeGreaterThan(0);
      expect(recoverySteps.length).toBeLessThanOrEqual(2);
      expect(
        recoverySteps.reduce((total, step) => total + estimatedTaskSeconds(step.taskId, 2), 0),
      ).toBeLessThanOrEqual(90);

      const resumed = await new PostgresBootstrapRepository(database.db).load(user.id);
      expect(resumed?.activeSession?.session).toMatchObject({
        id: started.session.id,
        sessionKind: "recovery",
        parentSessionId: primary.id,
      });
      expect(resumed?.activeSession?.baseline).toBe(4);

      current = started.session;
      for (const step of recoverySteps) {
        const target = taskSuccessTarget(step.taskId, 2);
        current = (
          await commands.execute({
            userId: user.id,
            operationId: `recovery-child-task-${step.index}`,
            requestHash: `recovery-child-task-hash-${step.index}`,
            observedAt: new Date(`2026-09-24T06:01:${10 + step.index}.000Z`),
            command: {
              type: "task",
              sessionId: current.id,
              expectedVersion: current.version,
              stepIndex: step.index,
              taskId: step.taskId,
              correct: target,
              total: target,
              durationMs: 1_000,
            },
          })
        ).session;
      }
      const completedRecovery = (
        await commands.execute({
          userId: user.id,
          operationId: "recovery-child-post-0001",
          requestHash: "recovery-child-post-hash",
          observedAt: new Date("2026-09-24T06:01:30.000Z"),
          command: {
            type: "post_rating",
            sessionId: current.id,
            expectedVersion: current.version,
            value: 6,
          },
        })
      ).session;
      expect(completedRecovery.followUpDueAt).not.toBeNull();

      const [primaryRow, recoveryRow, userRow] = await Promise.all([
        database.db
          .select({ followUpDueAt: wakeSessions.followUpDueAt })
          .from(wakeSessions)
          .where(sql`${wakeSessions.id} = ${primary.id}::uuid`)
          .limit(1),
        database.db
          .select({ followUpDueAt: wakeSessions.followUpDueAt })
          .from(wakeSessions)
          .where(sql`${wakeSessions.id} = ${completedRecovery.id}::uuid`)
          .limit(1),
        database.db
          .select({ learningSessionCount: users.learningSessionCount })
          .from(users)
          .where(sql`${users.id} = ${user.id}::uuid`)
          .limit(1),
      ]);
      expect(primaryRow[0]?.followUpDueAt).toBeNull();
      expect(recoveryRow[0]?.followUpDueAt).not.toBeNull();
      expect(userRow[0]?.learningSessionCount).toBe(1);

      const history = await new PostgresSessionHistoryRepository(database.db).listCompleted(
        user.id,
        20,
      );
      expect(history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: primary.id,
            sessionKind: "primary",
            parentSessionId: null,
            baseline: 3,
            postRating: 4,
          }),
          expect.objectContaining({
            id: completedRecovery.id,
            sessionKind: "recovery",
            parentSessionId: primary.id,
            baseline: 4,
            postRating: 6,
          }),
        ]),
      );
      const profile = await new PostgresAnalyticsRepository(database.db).recompute(user.id);
      expect(profile.averageDelta).toMatchObject({ value: 1, evidenceCount: 1 });

      await deletion.deleteUser(user.id, "wake-recovery-cleanup");
    });
  },
);
