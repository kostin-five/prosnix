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
  it("создаёт отдельный идемпотентный recovery после слабого результата", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(
      { ...testConfig, wakeLowEffectRecoveryEnabled: true },
      {
        ...dependencies,
        sessionCommands: createMemorySessionCommands(dependencies.user.id),
        now: () => testNow,
      },
    );
    const cookie = await authenticateTestUser(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { cookie, "idempotency-key": "recovery-create-1" },
      payload: { timezone: "Europe/Moscow", wakeContext: "night_sleep", durationMinutes: 5 },
    });
    const primaryId = created.json().id as string;
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${primaryId}/baseline`,
      headers: { cookie, "idempotency-key": "recovery-baseline-1", "if-match": "1" },
      payload: { value: 3 },
    });
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${primaryId}/steps/0`,
      headers: { cookie, "idempotency-key": "recovery-task-0001", "if-match": "2" },
      payload: { taskId: "math", correct: 1, total: 1, durationMs: 1000 },
    });
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${primaryId}/steps/1`,
      headers: { cookie, "idempotency-key": "recovery-task-0002", "if-match": "3" },
      payload: { taskId: "memory", correct: 1, total: 1, durationMs: 1000 },
    });
    const primary = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${primaryId}/post-rating`,
      headers: { cookie, "idempotency-key": "recovery-rating-1", "if-match": "4" },
      payload: { value: 4 },
    });
    expect(primary.json()).toMatchObject({
      recoveryOffer: { status: "eligible", maxDurationSeconds: 90 },
    });

    const recoveryHeaders = {
      cookie,
      "idempotency-key": "recovery-start-1",
      "if-match": "5",
    };
    const recovery = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${primaryId}/recovery`,
      headers: recoveryHeaders,
    });
    const replay = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${primaryId}/recovery`,
      headers: recoveryHeaders,
    });
    expect(recovery.statusCode).toBe(201);
    expect(recovery.json()).toMatchObject({
      sessionKind: "recovery",
      parentSessionId: primaryId,
      baseline: 4,
      status: "in_progress",
      assignment: { steps: [{ taskId: "reaction" }] },
    });
    expect(replay.json()).toEqual(recovery.json());
    await app.close();
  });

  it("сохраняет явный отказ и больше не предлагает recovery", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(
      { ...testConfig, wakeLowEffectRecoveryEnabled: true },
      {
        ...dependencies,
        sessionCommands: createMemorySessionCommands(dependencies.user.id),
        now: () => testNow,
      },
    );
    const cookie = await authenticateTestUser(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { cookie, "idempotency-key": "decline-create-1" },
      payload: { timezone: "Europe/Moscow", wakeContext: "night_sleep", durationMinutes: 5 },
    });
    const sessionId = created.json().id as string;
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/baseline`,
      headers: { cookie, "idempotency-key": "decline-baseline-1", "if-match": "1" },
      payload: { value: 3 },
    });
    for (const [index, taskId] of ["math", "memory"].entries()) {
      await app.inject({
        method: "PUT",
        url: `/api/v1/sessions/${sessionId}/steps/${index}`,
        headers: {
          cookie,
          "idempotency-key": `decline-task-000${index}`,
          "if-match": String(index + 2),
        },
        payload: { taskId, correct: 1, total: 1, durationMs: 1000 },
      });
    }
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/post-rating`,
      headers: { cookie, "idempotency-key": "decline-rating-1", "if-match": "4" },
      payload: { value: 4 },
    });
    const declined = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/recovery/decline`,
      headers: { cookie, "idempotency-key": "decline-recovery-1", "if-match": "5" },
    });

    expect(declined.json()).toMatchObject({
      version: 6,
      recoveryOffer: { status: "declined", recoverySessionId: null },
    });
    await app.close();
  });

  it("идемпотентно заменяет текущий шаг и возвращает effectiveSteps", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(
      { ...testConfig, wakeTaskSubstitutionEnabled: true },
      {
        ...dependencies,
        sessionCommands: createMemorySessionCommands(dependencies.user.id),
        now: () => testNow,
      },
    );
    const cookie = await authenticateTestUser(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { cookie, "idempotency-key": "replace-create-1" },
      payload: { timezone: "Europe/Moscow", wakeContext: "night_sleep", durationMinutes: 5 },
    });
    const sessionId = created.json().id as string;
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/baseline`,
      headers: { cookie, "idempotency-key": "replace-baseline-1", "if-match": "1" },
      payload: { value: 3 },
    });
    const nextHeaders = {
      cookie,
      "idempotency-key": "replace-next-0001",
      "if-match": "2",
    };
    const nextReplaced = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/steps/1/substitution`,
      headers: nextHeaders,
      payload: { reason: "unwilling_now" },
    });
    const nextReplayed = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/steps/1/substitution`,
      headers: nextHeaders,
      payload: { reason: "unwilling_now" },
    });
    expect(nextReplaced.statusCode).toBe(200);
    expect(nextReplaced.json()).toMatchObject({
      version: 3,
      currentStepIndex: 0,
      effectiveSteps: [{ taskId: "math" }, { taskId: "reaction" }],
      substitutions: [
        {
          stepIndex: 1,
          originalTaskId: "memory",
          replacementTaskId: "reaction",
          reason: "unwilling_now",
        },
      ],
    });
    expect(nextReplayed.json()).toEqual(nextReplaced.json());

    const currentReplaced = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/steps/0/substitution`,
      headers: {
        cookie,
        "idempotency-key": "replace-current-1",
        "if-match": "3",
      },
      payload: { reason: "cannot_do" },
    });
    expect(currentReplaced.json()).toMatchObject({
      version: 4,
      currentStepIndex: 0,
      effectiveSteps: [{ taskId: "stroop" }, { taskId: "reaction" }],
      substitutions: [
        { stepIndex: 1, replacementTaskId: "reaction" },
        { stepIndex: 0, replacementTaskId: "stroop", reason: "cannot_do" },
      ],
    });
    await app.close();
  });

  it("закрывает активную сессию POST-запросом без тела", async () => {
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
      headers: { cookie, "idempotency-key": "create-abandon-1" },
      payload: { timezone: "Europe/Moscow", wakeContext: "night_sleep", durationMinutes: 5 },
    });

    const abandoned = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${created.json().id}/abandon`,
      headers: { cookie, "idempotency-key": "abandon-1", "if-match": "1" },
    });

    expect(abandoned.statusCode).toBe(200);
    expect(abandoned.json()).toMatchObject({ status: "abandoned", version: 2 });
    await app.close();
  });

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
      payload: { timezone: "Europe/Moscow", wakeContext: "night_sleep", durationMinutes: 5 },
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
      payload: {
        taskId: "math",
        correct: 3,
        total: 4,
        durationMs: 20_000,
        difficultyLevel: 2,
      },
    });
    expect(firstTask.json()).toMatchObject({
      currentStepIndex: 1,
      version: 3,
      tasks: [{ correct: 3, total: 4, difficultyLevel: 2 }],
    });

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
    expect(completed.json()).toMatchObject({
      status: "protocol_completed",
      version: 5,
      postRating: 7,
    });

    const followUp = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/follow-up`,
      headers: { cookie, "idempotency-key": "followup-0001" },
      payload: { outcome: "up" },
    });
    expect(followUp.json()).toMatchObject({ followUp: "up", version: 6 });
    await app.close();
  });

  it("rejects an unsupported task difficulty at the HTTP boundary", async () => {
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
      headers: { cookie, "idempotency-key": "create-difficulty-1" },
      payload: { timezone: "Europe/Moscow", wakeContext: "night_sleep", durationMinutes: 5 },
    });
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${created.json().id}/baseline`,
      headers: { cookie, "idempotency-key": "baseline-difficulty-1", "if-match": "1" },
      payload: { value: 3 },
    });

    const result = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${created.json().id}/steps/0`,
      headers: { cookie, "idempotency-key": "task-difficulty-1", "if-match": "2" },
      payload: { taskId: "math", correct: 1, total: 1, durationMs: 1000, difficultyLevel: 4 },
    });

    expect(result.statusCode).toBe(400);
    await app.close();
  });

  it("не принимает недостаточный результат нового десятиминутного протокола", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      sessionCommands: createMemorySessionCommands(dependencies.user.id, {
        protocolVersion: 3,
        strategyVersion: "learning-v2",
      }),
      now: () => testNow,
    });
    const cookie = await authenticateTestUser(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { cookie, "idempotency-key": "create-strict-10" },
      payload: { timezone: "Europe/Moscow", wakeContext: "night_sleep", durationMinutes: 10 },
    });
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${created.json().id}/baseline`,
      headers: { cookie, "idempotency-key": "baseline-strict-10", "if-match": "1" },
      payload: { value: 3 },
    });

    const rejected = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${created.json().id}/steps/0`,
      headers: { cookie, "idempotency-key": "task-strict-low", "if-match": "2" },
      payload: { taskId: "math", correct: 3, total: 3, durationMs: 20_000 },
    });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toMatchObject({
      code: "invalid_transition",
      canonicalSession: { currentStepIndex: 0, version: 2 },
    });

    const accepted = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${created.json().id}/steps/0`,
      headers: { cookie, "idempotency-key": "task-strict-pass", "if-match": "2" },
      payload: { taskId: "math", correct: 5, total: 7, durationMs: 35_000 },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ currentStepIndex: 1, version: 3 });
    await app.close();
  });
});
