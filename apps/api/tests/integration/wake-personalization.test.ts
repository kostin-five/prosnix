import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresAnalyticsRepository,
  PostgresSessionCommandRepository,
  PostgresUserDeletionRepository,
  PostgresWakePersonalizationRepository,
} from "@awc/db";

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
              correct: 1,
              total: 1,
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
  },
);
