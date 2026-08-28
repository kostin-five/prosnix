import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app/create-app.js";
import {
  authenticateTestUser,
  createMemoryDependencies,
  createMemorySessionCommands,
  testConfig,
  testNow,
} from "../helpers.js";

describe("идемпотентность и конфликт версий", () => {
  it("повторяет тот же ответ и отвергает изменённый запрос с тем же ключом", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      sessionCommands: createMemorySessionCommands(dependencies.user.id),
      now: () => testNow,
    });
    const cookie = await authenticateTestUser(app);
    const headers = { cookie, "idempotency-key": "create-0001" };

    const first = await app.inject({ method: "POST", url: "/api/v1/sessions", headers, payload: { timezone: "UTC" } });
    const retry = await app.inject({ method: "POST", url: "/api/v1/sessions", headers, payload: { timezone: "UTC" } });
    const changed = await app.inject({ method: "POST", url: "/api/v1/sessions", headers, payload: { timezone: "Europe/Moscow" } });

    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual(first.json());
    expect(changed.statusCode).toBe(409);
    expect(changed.json()).toMatchObject({ code: "idempotency_conflict" });
    await app.close();
  });

  it("не перезаписывает состояние устаревшей версией", async () => {
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
      payload: { timezone: "UTC" },
    });
    const sessionId = created.json().id as string;
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/baseline`,
      headers: { cookie, "idempotency-key": "baseline-0001", "if-match": "1" },
      payload: { value: 3 },
    });
    const stale = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/steps/0`,
      headers: { cookie, "idempotency-key": "task-stale01", "if-match": "1" },
      payload: { taskId: "math", correct: 2, total: 3, durationMs: 20_000 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      code: "stale_version",
      canonicalSession: { version: 2, currentStepIndex: 0 },
    });
    await app.close();
  });
});
