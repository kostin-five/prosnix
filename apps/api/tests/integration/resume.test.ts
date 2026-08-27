import { describe, expect, it } from "vitest";

import type { BootstrapSession } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import {
  cookieFrom,
  createMemoryDependencies,
  signedInitData,
  testConfig,
  testNow,
} from "../helpers.js";

describe("resume after application restart", () => {
  it("loads the last confirmed step from durable bootstrap state", async () => {
    const dependencies = createMemoryDependencies();
    const activeSession: BootstrapSession = {
      session: {
        id: "00000000-0000-4000-8000-000000000100",
        userId: dependencies.user.id,
        assignmentId: "00000000-0000-4000-8000-000000000101",
        status: "in_progress",
        currentStepIndex: 1,
        version: 3,
        startedAt: testNow,
        protocolCompletedAt: null,
        followUpDueAt: null,
        abandonedAt: null,
      },
      protocol: {
        key: "learning-cognitive",
        version: 1,
        title: "Attention start",
        steps: [{ index: 0, taskId: "math" }, { index: 1, taskId: "memory" }],
      },
      assignment: {
        strategyVersion: "learning-v1",
        phase: "learning",
        hypothesis: "Measure a cognitive baseline",
      },
      baseline: 3,
      postRating: null,
    };
    const durable = createMemoryDependencies({
      user: dependencies.user,
      activeSession,
    });

    const firstApp = await createApp(testConfig, { ...durable, now: () => testNow });
    const auth = await firstApp.inject({
      method: "POST",
      url: "/api/v1/auth/telegram",
      payload: { initData: signedInitData() },
    });
    const cookie = cookieFrom(auth.headers["set-cookie"]);
    await firstApp.close();

    const restartedApp = await createApp(testConfig, { ...durable, now: () => testNow });
    const response = await restartedApp.inject({
      method: "GET",
      url: "/api/v1/bootstrap",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().activeSession).toMatchObject({
      session: { currentStepIndex: 1, version: 3 },
      baseline: 3,
    });
    await restartedApp.close();
  });
});
