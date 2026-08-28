import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app/create-app.js";
import {
  authenticateTestUser,
  createMemoryDependencies,
  createMemorySessionCommands,
  testConfig,
  testNow,
} from "../helpers.js";

describe("контракт команд wake-сессии", () => {
  it("сохраняет полный цикл и возвращает каноническую версию после каждого шага", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      sessionCommands: createMemorySessionCommands(dependencies.user.id),
      now: () => testNow,
    });
    const cookie = await authenticateTestUser(app);

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { cookie, "idempotency-key": "create-0001" },
      payload: { timezone: "Europe/Moscow" },
    });
    expect(created.statusCode).toBe(201);
    const sessionId = created.json().id as string;
    expect(created.json()).toMatchObject({ status: "assigned", version: 1 });

    const baseline = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/baseline`,
      headers: { cookie, "idempotency-key": "baseline-0001", "if-match": "1" },
      payload: { value: 3 },
    });
    expect(baseline.json()).toMatchObject({ status: "in_progress", version: 2, baseline: 3 });

    const firstTask = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/steps/0`,
      headers: { cookie, "idempotency-key": "task-0000001", "if-match": "2" },
      payload: { taskId: "math", correct: 2, total: 3, durationMs: 20_000 },
    });
    expect(firstTask.json()).toMatchObject({ currentStepIndex: 1, version: 3 });

    const secondTask = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/steps/1`,
      headers: { cookie, "idempotency-key": "task-0000002", "if-match": "3" },
      payload: { taskId: "memory", correct: 1, total: 1, durationMs: 15_000 },
    });
    expect(secondTask.json()).toMatchObject({ currentStepIndex: 2, version: 4 });

    const completed = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/post-rating`,
      headers: { cookie, "idempotency-key": "rating-00001", "if-match": "4" },
      payload: { value: 7 },
    });
    expect(completed.json()).toMatchObject({ status: "protocol_completed", version: 5, postRating: 7 });

    const followUp = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/follow-up`,
      headers: { cookie, "idempotency-key": "followup-0001" },
      payload: { outcome: "up" },
    });
    expect(followUp.json()).toMatchObject({ followUp: "up", version: 6 });
    await app.close();
  });
});
