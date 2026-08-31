import { describe, expect, it } from "vitest";

import type { WakeScheduleValue } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

describe("wake schedule API contract", () => {
  it("stores one schedule and returns the next trigger", async () => {
    const dependencies = createMemoryDependencies();
    let schedule: WakeScheduleValue | null = null;
    const app = await createApp(testConfig, {
      ...dependencies,
      now: () => testNow,
      wakeScheduleRepository: {
        findByUserId: async () => schedule,
        save: async (input) => {
          schedule = {
            userId: input.userId,
            localTime: input.localTime,
            timezone: input.timezone,
            enabled: input.enabled,
            nextTriggerAt: input.nextTriggerAt,
            botStatus: "unknown",
            revision: (schedule?.revision ?? 0) + 1,
          };
          return schedule;
        },
        snooze: async (userId, nextTriggerAt) => {
          if (!schedule?.enabled) return null;
          schedule = { ...schedule, userId, nextTriggerAt, revision: schedule.revision + 1 };
          return schedule;
        },
      },
    });
    const cookie = await authenticateTestUser(app);
    const initial = await app.inject({
      method: "GET",
      url: "/api/v1/me/wake-schedule",
      headers: { cookie },
    });
    expect(initial.json()).toEqual({ schedule: null });

    const saved = await app.inject({
      method: "PUT",
      url: "/api/v1/me/wake-schedule",
      headers: { cookie },
      payload: { localTime: "07:00", timezone: "Europe/Moscow", enabled: true },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      localTime: "07:00",
      timezone: "Europe/Moscow",
      enabled: true,
      nextTriggerAt: "2026-08-28T04:00:00.000Z",
      botStatus: "unknown",
      revision: 1,
    });
    const snoozed = await app.inject({
      method: "POST",
      url: "/api/v1/me/wake-schedule/snooze",
      headers: { cookie },
    });
    expect(snoozed.statusCode).toBe(200);
    expect(snoozed.json()).toMatchObject({
      localTime: "07:00",
      nextTriggerAt: "2026-08-27T06:05:00.000Z",
      revision: 2,
    });
    await app.close();
  });

  it("rejects invalid data and unauthenticated access", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      now: () => testNow,
      wakeScheduleRepository: {
        findByUserId: async () => null,
        save: async () => {
          throw new Error("must not save");
        },
        snooze: async () => null,
      },
    });
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/v1/me/wake-schedule",
          payload: { localTime: "07:00", timezone: "UTC", enabled: true },
        })
      ).statusCode,
    ).toBe(401);
    const cookie = await authenticateTestUser(app);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/v1/me/wake-schedule",
          headers: { cookie },
          payload: { localTime: "25:00", timezone: "UTC", enabled: true },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/me/wake-schedule/snooze",
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(409);
    await app.close();
  });
});
