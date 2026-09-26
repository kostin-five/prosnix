import { afterAll, describe, expect, it } from "vitest";

import {
  connectDatabase,
  PostgresUserDeletionRepository,
  PostgresWakeNotificationRepository,
  PostgresWakePersonalizationRepository,
  PostgresWakeScheduleRepository,
} from "@awc/db";

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl
  ? ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  : false;

describe.runIf(Boolean(databaseUrl) && localDatabase)("жизненная цель в PostgreSQL", () => {
  const database = connectDatabase(databaseUrl!);
  const goals = new PostgresWakePersonalizationRepository(database.db);
  const deletion = new PostgresUserDeletionRepository(database.db);

  afterAll(async () => database.close());

  it("изолирует пользователей, поддерживает повтор и удаляется вместе с профилем", async () => {
    const first = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId: 910000000071n, locale: "ru" }),
    );
    const second = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId: 910000000072n, locale: "ru" }),
    );
    await deletion.deleteUser(first.id, "goal-test-before");
    await deletion.deleteUser(second.id, "goal-test-before");
    const owner = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId: 910000000071n, locale: "ru" }),
    );
    const other = await database.unitOfWork.transaction(({ users }) =>
      users.createFromTelegram({ telegramUserId: 910000000072n, locale: "ru" }),
    );
    const command = {
      userId: owner.id,
      expectedRevision: 0,
      operationId: "life-goal-integration-1",
      text: "Построить своё дело",
      now: new Date("2026-07-01T06:00:00Z"),
    };
    const saved = await goals.saveLifeGoal(command);
    expect(saved).toEqual({ text: command.text, revision: 1 });
    await expect(goals.saveLifeGoal(command)).resolves.toEqual(saved);
    await expect(goals.saveLifeGoal({ ...command, text: "Другая цель" })).rejects.toMatchObject({
      code: "idempotency_conflict",
    });
    await expect(
      goals.saveLifeGoal({ ...command, operationId: "life-goal-integration-2" }),
    ).rejects.toMatchObject({ code: "stale_version" });
    await expect(goals.loadLifeGoal(other.id)).resolves.toEqual({ text: "", revision: 0 });
    await new PostgresWakeScheduleRepository(database.db).save({
      userId: owner.id,
      localTime: "09:00",
      timezone: "Europe/Moscow",
      enabled: true,
      nextTriggerAt: new Date("2026-07-02T06:00:00Z"),
      now: new Date("2026-07-02T05:59:00Z"),
    });
    const claimed = await new PostgresWakeNotificationRepository(database.db).claimDue(
      new Date("2026-07-02T06:00:00Z"),
      100,
    );
    expect(
      claimed.notifications.find((notification) => notification.userId === owner.id),
    ).toMatchObject({
      userId: owner.id,
      lifeGoal: command.text,
    });
    await expect(
      goals.saveLifeGoal({
        ...command,
        operationId: "life-goal-integration-3",
        expectedRevision: 1,
        text: "",
      }),
    ).resolves.toEqual({ text: "", revision: 2 });
    await deletion.deleteUser(owner.id, "goal-test-after");
    await expect(goals.loadLifeGoal(owner.id)).resolves.toEqual({ text: "", revision: 0 });
    await deletion.deleteUser(other.id, "goal-test-after");
  });
});
