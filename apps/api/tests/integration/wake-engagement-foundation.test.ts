import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
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

    afterAll(async () => {
      const deletion = new PostgresUserDeletionRepository(database.db);
      const users = await database.unitOfWork.transaction(async ({ users }) =>
        Promise.all([
          users.findByTelegramId(telegramUserId),
          users.findByTelegramId(otherTelegramUserId),
        ]),
      );
      await Promise.all(
        users
          .filter((user) => user !== null)
          .map((user, index) => deletion.deleteUser(user.id, `wake-engagement-cleanup-${index}`)),
      );
      await database.close();
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
