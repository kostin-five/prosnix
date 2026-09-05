import { describe, expect, it } from "vitest";

import type {
  WakeCapabilityProfile,
  WakePersonalizationRepository,
  WakeRoutine,
} from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

function memoryPersonalization(): WakePersonalizationRepository {
  let profile: WakeCapabilityProfile = {
    movementLevel: "none",
    availableResources: [],
    excludedTaskIds: [],
    defaultDurationMinutes: 5,
    onboardingCompleted: false,
    revision: 0,
  };
  let routine: WakeRoutine = { enabled: false, items: [], revision: 0 };
  return {
    loadProfile: async () => profile,
    saveProfile: async (input) =>
      (profile = { ...input.profile, revision: input.expectedRevision + 1 }),
    loadRoutine: async () => routine,
    loadRoutineRun: async () => null,
    saveRoutine: async (input) =>
      (routine = { ...input.routine, revision: input.expectedRevision + 1 }),
    saveRoutineRun: async (input) => ({
      sessionId: input.sessionId,
      items: routine.items,
      completedItemIds: input.completedItemIds,
      revision: input.expectedRevision + 1,
      completedAt: null,
    }),
  };
}

describe("контракт персонализации", () => {
  it("проверяет auth, заголовки и сохраняет профиль и рутину", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      wakePersonalizationRepository: memoryPersonalization(),
      now: () => testNow,
    });
    expect((await app.inject({ method: "GET", url: "/api/v1/me/wake-profile" })).statusCode).toBe(
      401,
    );
    const cookie = await authenticateTestUser(app);
    const profile = await app.inject({
      method: "PUT",
      url: "/api/v1/me/wake-profile",
      headers: { cookie, "idempotency-key": "profile-contract-1", "if-match": "0" },
      payload: {
        movementLevel: "light",
        availableResources: ["water"],
        excludedTaskIds: ["squats"],
        defaultDurationMinutes: 2,
        onboardingCompleted: true,
      },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({ movementLevel: "light", revision: 1 });
    const routine = await app.inject({
      method: "PUT",
      url: "/api/v1/me/wake-routine",
      headers: { cookie, "idempotency-key": "routine-contract-1", "if-match": "0" },
      payload: { enabled: true, items: [{ id: "water", title: " Выпить воды " }] },
    });
    expect(routine.statusCode).toBe(200);
    expect(routine.json()).toMatchObject({
      enabled: true,
      revision: 1,
      items: [{ title: "Выпить воды" }],
    });
    await app.close();
  });

  it("отклоняет неизвестные значения и запись без idempotency key", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      wakePersonalizationRepository: memoryPersonalization(),
      now: () => testNow,
    });
    const cookie = await authenticateTestUser(app);
    const invalid = await app.inject({
      method: "PUT",
      url: "/api/v1/me/wake-profile",
      headers: { cookie, "if-match": "0" },
      payload: {
        movementLevel: "medical",
        availableResources: [],
        excludedTaskIds: [],
        defaultDurationMinutes: 5,
        onboardingCompleted: true,
      },
    });
    expect(invalid.statusCode).toBe(400);
    const emptyProfile = await app.inject({
      method: "PUT",
      url: "/api/v1/me/wake-profile",
      headers: { cookie, "idempotency-key": "profile-contract-empty", "if-match": "0" },
      payload: {
        movementLevel: "none",
        availableResources: [],
        excludedTaskIds: ["math", "memory", "stroop", "reaction"],
        defaultDurationMinutes: 5,
        onboardingCompleted: true,
      },
    });
    expect(emptyProfile.statusCode).toBe(400);
    expect(emptyProfile.json()).toMatchObject({ code: "no_eligible_wake_tasks" });
    await app.close();
  });
});
