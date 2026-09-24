import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

describe("session history contract", () => {
  it("returns only repository history for the authenticated user", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      sessionHistoryRepository: {
        listCompleted: async (userId, limit) => {
          expect(userId).toBe(dependencies.user.id);
          expect(limit).toBe(20);
          return [
            {
              id: "session-1",
              sessionKind: "primary",
              parentSessionId: null,
              completedAt: testNow,
              baseline: 3,
              postRating: 7,
              durationMs: 60_000,
              followUp: "up",
              tasks: [{ taskId: "math", category: "cognitive" }],
              wakeContext: "short_nap",
              durationMinutes: 2,
            },
          ];
        },
      },
      now: () => testNow,
    });
    expect((await app.inject({ url: "/api/v1/sessions/history" })).statusCode).toBe(401);
    const cookie = await authenticateTestUser(app);
    const response = await app.inject({
      url: "/api/v1/sessions/history?limit=999",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      sessions: [
        {
          id: "session-1",
          sessionKind: "primary",
          parentSessionId: null,
          baseline: 3,
          postRating: 7,
          followUp: "up",
        },
      ],
    });
    await app.close();
  });
});
