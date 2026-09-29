import { describe, expect, it } from "vitest";

import type { SessionCommand, SessionCommandRepository } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import {
  authenticateTestUser,
  createMemoryDependencies,
  createMemorySessionCommands,
  testConfig,
  testNow,
} from "../helpers.js";

describe("контракт режима без телефона", () => {
  it("передаёт режим и источник завершения в серверную команду", async () => {
    const dependencies = createMemoryDependencies();
    const base = createMemorySessionCommands(dependencies.user.id);
    const seen: SessionCommand[] = [];
    const commands: SessionCommandRepository = {
      execute: async (envelope) => {
        seen.push(envelope.command);
        if (envelope.command.type === "task") {
          const previous = await base.execute({
            ...envelope,
            operationId: "task-contract-previous",
            requestHash: "task-contract-previous-hash",
            command: { ...envelope.command, completionSource: "manual" },
          });
          return previous;
        }
        return base.execute(envelope);
      },
    };
    const app = await createApp(testConfig, {
      ...dependencies,
      sessionCommands: commands,
      now: () => testNow,
    });
    const cookie = await authenticateTestUser(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { cookie, "idempotency-key": "hands-free-create-1" },
      payload: {
        timezone: "UTC",
        wakeContext: "night_sleep",
        durationMinutes: 2,
        interactionMode: "hands_free",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(seen[0]).toMatchObject({ type: "create", interactionMode: "hands_free" });
    const sessionId = created.json().id as string;
    await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/baseline`,
      headers: { cookie, "idempotency-key": "hands-free-baseline-1", "if-match": "1" },
      payload: { value: 3 },
    });
    const task = await app.inject({
      method: "PUT",
      url: `/api/v1/sessions/${sessionId}/steps/0`,
      headers: { cookie, "idempotency-key": "hands-free-task-1", "if-match": "2" },
      payload: {
        taskId: "math",
        correct: 1,
        total: 1,
        durationMs: 60_000,
        completionSource: "timer",
      },
    });
    expect(task.statusCode).toBe(200);
    expect(seen.at(-1)).toMatchObject({ type: "task", completionSource: "timer" });
    await app.close();
  });
});
