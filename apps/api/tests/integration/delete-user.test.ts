import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

describe("удаление данных пользователя", () => {
  it("удаляет только владельца текущей сессии и очищает cookie", async () => {
    const dependencies = createMemoryDependencies();
    const users = new Set([dependencies.user.id, "00000000-0000-4000-8000-000000000099"]);
    const app = await createApp(testConfig, {
      ...dependencies,
      userDeletionRepository: {
        deleteUser: async (userId) => users.delete(userId),
      },
      now: () => testNow,
    });

    expect((await app.inject({ method: "DELETE", url: "/api/v1/me" })).statusCode).toBe(401);
    const cookie = await authenticateTestUser(app);
    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/me",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(204);
    expect(users.has(dependencies.user.id)).toBe(false);
    expect(users.has("00000000-0000-4000-8000-000000000099")).toBe(true);
    expect(response.headers["set-cookie"]).toContain("awc_session=;");
    await app.close();
  });
});
