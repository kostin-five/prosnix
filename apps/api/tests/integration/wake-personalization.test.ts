import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresAnalyticsRepository,
  PostgresSessionCommandRepository,
  PostgresUserDeletionRepository,
  PostgresWakePersonalizationRepository,
  sql,
} from "@awc/db";
import { taskSuccessTarget } from "@awc/domain";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)(
  "PostgreSQL персонализация пробуждения",
  () => {
    const connections: Array<ReturnType<typeof connectDatabase>> = [];

    function connect() {
      const connection = connectDatabase(databaseUrl!);
      connections.push(connection);
      return connection;
    }

    afterAll(async () => {
      await Promise.all(connections.map((connection) => connection.close()));
    });

    it("сохраняет снимок профиля и держит рутину вне экспериментальной аналитики", async () => {
      const database = connect();
      const telegramUserId = 910000000007n;
      let user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );
      const deletion = new PostgresUserDeletionRepository(database.db);
      await deletion.deleteUser(user.id, "personalization-cleanup-before");
      user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );

      const personalization = new PostgresWakePersonalizationRepository(database.db);
      const savedProfile = await personalization.saveProfile({
        userId: user.id,
        expectedRevision: 0,
        operationId: "personalization-profile-0001",
        profile: {
          movementLevel: "light",
          availableResources: ["water"],
          excludedTaskIds: ["squats"],
          defaultDurationMinutes: 2,
          onboardingCompleted: true,
        },
        now: new Date("2026-09-04T06:00:00.000Z"),
      });
      expect(savedProfile).toMatchObject({ revision: 1, defaultDurationMinutes: 2 });
      await expect(
        personalization.saveProfile({
          userId: user.id,
          expectedRevision: 0,
          operationId: "personalization-profile-0001",
          profile: {
            movementLevel: "light",
            availableResources: ["water"],
            excludedTaskIds: ["squats"],
            defaultDurationMinutes: 2,
            onboardingCompleted: true,
          },
          now: new Date("2026-09-04T06:00:01.000Z"),
        }),
      ).resolves.toEqual(savedProfile);

      await personalization.saveRoutine({
        userId: user.id,
        expectedRevision: 0,
        operationId: "personalization-routine-0001",
        routine: { enabled: true, items: [{ id: "water", title: "Выпить воды" }] },
        now: new Date("2026-09-04T06:01:00.000Z"),
      });

      const commands = new PostgresSessionCommandRepository(database.db);
      let session = (
        await commands.execute({
          userId: user.id,
          operationId: "personalization-session-0001",
          requestHash: "personalization-session-hash",
          observedAt: new Date("2026-09-04T06:02:00.000Z"),
          command: {
            type: "create",
            timezone: "Europe/Moscow",
            wakeContext: "short_nap",
            durationMinutes: 2,
          },
        })
      ).session;
      expect(session).toMatchObject({
        wakeContext: "short_nap",
        durationMinutes: 2,
        personalization: { profileRevision: 1, excludedTaskIds: ["squats"] },
      });
      expect(session.assignment.steps.every(({ taskId }) => taskId !== "squats")).toBe(true);

      session = (
        await commands.execute({
          userId: user.id,
          operationId: "personalization-baseline-0001",
          requestHash: "personalization-baseline-hash",
          observedAt: new Date("2026-09-04T06:02:10.000Z"),
          command: {
            type: "baseline",
            sessionId: session.id,
            expectedVersion: session.version,
            value: 3,
          },
        })
      ).session;
      for (const step of session.assignment.steps) {
        const target = taskSuccessTarget(step.taskId, session.durationMinutes);
        session = (
          await commands.execute({
            userId: user.id,
            operationId: `personalization-step-${step.index}`,
            requestHash: `personalization-step-hash-${step.index}`,
            observedAt: new Date(`2026-09-04T06:02:${20 + step.index}.000Z`),
            command: {
              type: "task",
              sessionId: session.id,
              expectedVersion: session.version,
              stepIndex: step.index,
              taskId: step.taskId,
              correct: target,
              total: target,
              durationMs: 500,
            },
          })
        ).session;
      }
      session = (
        await commands.execute({
          userId: user.id,
          operationId: "personalization-post-0001",
          requestHash: "personalization-post-hash",
          observedAt: new Date("2026-09-04T06:03:00.000Z"),
          command: {
            type: "post_rating",
            sessionId: session.id,
            expectedVersion: session.version,
            value: 7,
          },
        })
      ).session;

      const analytics = new PostgresAnalyticsRepository(database.db);
      const beforeRoutine = await analytics.recompute(user.id);
      const run = await personalization.saveRoutineRun({
        userId: user.id,
        sessionId: session.id,
        expectedRevision: 0,
        operationId: "personalization-run-0001",
        completedItemIds: ["water"],
        now: new Date("2026-09-04T06:04:00.000Z"),
      });
      expect(run).toMatchObject({ completedItemIds: ["water"], revision: 1 });
      expect(await personalization.loadRoutineRun(user.id, session.id)).toEqual(run);
      const afterRoutine = await analytics.recompute(user.id);
      expect({ ...afterRoutine, computedAt: beforeRoutine.computedAt }).toEqual(beforeRoutine);

      await deletion.deleteUser(user.id, "personalization-cleanup-after");
    });

    it("исследует разные фактические протоколы после семи завершённых сессий", async () => {
      const database = connect();
      const telegramUserId = 910000000017n;
      let user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );
      const deletion = new PostgresUserDeletionRepository(database.db);
      await deletion.deleteUser(user.id, "continuation-cleanup-before");
      user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );
      await database.db.execute(
        sql`update users set learning_session_count = 7 where id = ${user.id}::uuid`,
      );

      const commands = new PostgresSessionCommandRepository(database.db);
      const signatures: string[] = [];
      const abandoned = (
        await commands.execute({
          userId: user.id,
          operationId: "continuation-abandoned-create",
          requestHash: "continuation-abandoned-create-hash",
          observedAt: new Date("2026-09-07T06:55:00.000Z"),
          command: {
            type: "create",
            timezone: "Europe/Moscow",
            wakeContext: "night_sleep",
            durationMinutes: 5,
          },
        })
      ).session;
      const abandonedSignature = abandoned.assignment.steps.map(({ taskId }) => taskId).join(",");
      await commands.execute({
        userId: user.id,
        operationId: "continuation-abandoned-close",
        requestHash: "continuation-abandoned-close-hash",
        observedAt: new Date("2026-09-07T06:56:00.000Z"),
        command: {
          type: "abandon",
          sessionId: abandoned.id,
          expectedVersion: abandoned.version,
        },
      });
      for (let round = 0; round < 4; round += 1) {
        const minute = String(round * 5).padStart(2, "0");
        let session = (
          await commands.execute({
            userId: user.id,
            operationId: `continuation-create-${round}`,
            requestHash: `continuation-create-hash-${round}`,
            observedAt: new Date(`2026-09-07T07:${minute}:00.000Z`),
            command: {
              type: "create",
              timezone: "Europe/Moscow",
              wakeContext: "night_sleep",
              durationMinutes: 5,
            },
          })
        ).session;
        expect(session.assignment).toMatchObject({
          strategyVersion: "adaptive-v7",
          phase: "adaptive",
        });
        signatures.push(session.assignment.steps.map(({ taskId }) => taskId).join(","));
        session = (
          await commands.execute({
            userId: user.id,
            operationId: `continuation-baseline-${round}`,
            requestHash: `continuation-baseline-hash-${round}`,
            observedAt: new Date(`2026-09-07T07:${minute}:10.000Z`),
            command: {
              type: "baseline",
              sessionId: session.id,
              expectedVersion: session.version,
              value: 3,
            },
          })
        ).session;
        for (const step of session.assignment.steps) {
          const target = taskSuccessTarget(step.taskId, session.durationMinutes);
          session = (
            await commands.execute({
              userId: user.id,
              operationId: `continuation-task-${round}-${step.index}`,
              requestHash: `continuation-task-hash-${round}-${step.index}`,
              observedAt: new Date(`2026-09-07T07:${minute}:${20 + step.index}.000Z`),
              command: {
                type: "task",
                sessionId: session.id,
                expectedVersion: session.version,
                stepIndex: step.index,
                taskId: step.taskId,
                correct: target,
                total: target,
                durationMs: 1000,
              },
            })
          ).session;
        }
        await commands.execute({
          userId: user.id,
          operationId: `continuation-post-${round}`,
          requestHash: `continuation-post-hash-${round}`,
          observedAt: new Date(`2026-09-07T07:${minute}:40.000Z`),
          command: {
            type: "post_rating",
            sessionId: session.id,
            expectedVersion: session.version,
            value: 6,
          },
        });
      }

      expect(signatures).toHaveLength(4);
      expect(signatures[0]).not.toBe(abandonedSignature);
      expect(new Set(signatures).size).toBe(4);
      expect(signatures.slice(1).every((signature, index) => signature !== signatures[index])).toBe(
        true,
      );
      await deletion.deleteUser(user.id, "continuation-cleanup-after");
    });

    it("последовательно принимает все десять шагов нового десятиминутного протокола", async () => {
      const database = connect();
      const telegramUserId = 910000000027n;
      let user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );
      const deletion = new PostgresUserDeletionRepository(database.db);
      await deletion.deleteUser(user.id, "long-session-cleanup-before");
      user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );

      const personalization = new PostgresWakePersonalizationRepository(database.db);
      await personalization.saveProfile({
        userId: user.id,
        expectedRevision: 0,
        operationId: "long-session-profile-0001",
        profile: {
          movementLevel: "full",
          availableResources: ["water", "bright_light", "floor_space"],
          excludedTaskIds: [],
          defaultDurationMinutes: 10,
          onboardingCompleted: true,
        },
        now: new Date("2026-09-09T06:00:00.000Z"),
      });

      const commands = new PostgresSessionCommandRepository(database.db);
      let session = (
        await commands.execute({
          userId: user.id,
          operationId: "long-session-create-0001",
          requestHash: "long-session-create-hash",
          observedAt: new Date("2026-09-09T06:01:00.000Z"),
          command: {
            type: "create",
            timezone: "Europe/Moscow",
            wakeContext: "night_sleep",
            durationMinutes: 10,
          },
        })
      ).session;
      expect(session.assignment.protocolVersion).toBe(8);
      expect(session.assignment.steps).toHaveLength(10);
      expect(session.assignment.steps.map(({ taskId }) => taskId)).not.toContain("curtains");

      session = (
        await commands.execute({
          userId: user.id,
          operationId: "long-session-baseline-0001",
          requestHash: "long-session-baseline-hash",
          observedAt: new Date("2026-09-09T06:01:10.000Z"),
          command: {
            type: "baseline",
            sessionId: session.id,
            expectedVersion: session.version,
            value: 2,
          },
        })
      ).session;

      for (const step of session.assignment.steps) {
        const target = taskSuccessTarget(step.taskId, 10);
        session = (
          await commands.execute({
            userId: user.id,
            operationId: `long-session-step-${step.index}`,
            requestHash: `long-session-step-hash-${step.index}`,
            observedAt: new Date(`2026-09-09T06:01:${20 + step.index}.000Z`),
            command: {
              type: "task",
              sessionId: session.id,
              expectedVersion: session.version,
              stepIndex: step.index,
              taskId: step.taskId,
              correct: target,
              total: target,
              durationMs: 1_000,
            },
          })
        ).session;
      }

      expect(session).toMatchObject({
        status: "in_progress",
        currentStepIndex: session.assignment.steps.length,
        version: 2 + session.assignment.steps.length,
      });
      const completed = (
        await commands.execute({
          userId: user.id,
          operationId: "long-session-post-0001",
          requestHash: "long-session-post-hash",
          observedAt: new Date("2026-09-09T06:03:00.000Z"),
          command: {
            type: "post_rating",
            sessionId: session.id,
            expectedVersion: session.version,
            value: 6,
          },
        })
      ).session;
      expect(completed.status).toBe("protocol_completed");

      await deletion.deleteUser(user.id, "long-session-cleanup-after");
    });

    it("назначает новые задания только через включённый каталог v9", async () => {
      const database = connect();
      const telegramUserId = 910000000037n;
      let user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );
      const deletion = new PostgresUserDeletionRepository(database.db);
      await deletion.deleteUser(user.id, "catalog-v9-cleanup-before");
      user = await database.unitOfWork.transaction(({ users }) =>
        users.createFromTelegram({ telegramUserId, locale: "ru" }),
      );

      const personalization = new PostgresWakePersonalizationRepository(database.db);
      await personalization.saveProfile({
        userId: user.id,
        expectedRevision: 0,
        operationId: "catalog-v9-profile-0001",
        profile: {
          movementLevel: "full",
          availableResources: [
            "water",
            "bright_light",
            "floor_space",
            "wash_access",
            "active_movement",
          ],
          excludedTaskIds: [],
          defaultDurationMinutes: 5,
          onboardingCompleted: true,
        },
        now: new Date("2026-09-10T06:00:00.000Z"),
      });

      const commands = new PostgresSessionCommandRepository(database.db, {
        wakeTaskCatalogV9Enabled: true,
      });
      const session = (
        await commands.execute({
          userId: user.id,
          operationId: "catalog-v9-session-0001",
          requestHash: "catalog-v9-session-hash",
          observedAt: new Date("2026-09-10T06:01:00.000Z"),
          command: {
            type: "create",
            timezone: "Europe/Moscow",
            wakeContext: "night_sleep",
            durationMinutes: 5,
          },
        })
      ).session;

      expect(session.assignment.protocolVersion).toBe(9);
      expect(session.assignment.steps.map(({ taskId }) => taskId)).toEqual(
        expect.arrayContaining(["pushups"]),
      );
      await deletion.deleteUser(user.id, "catalog-v9-cleanup-after");
    });
  },
);
