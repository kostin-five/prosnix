import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app/create-app.js";
import {
  cookieFrom,
  createMemoryDependencies,
  signedInitData,
  testConfig,
  testNow,
} from "../helpers.js";

describe("auth and bootstrap API contract", () => {
  it("authenticates signed launch data and returns only the session owner", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      now: () => testNow,
    });

    const auth = await app.inject({
      method: "POST",
      url: "/api/v1/auth/telegram",
      payload: { initData: signedInitData() },
    });
    expect(auth.statusCode).toBe(204);
    const cookie = cookieFrom(auth.headers["set-cookie"]);

    const bootstrap = await app.inject({
      method: "GET",
      url: "/api/v1/bootstrap",
      headers: { cookie },
    });
    expect(bootstrap.statusCode).toBe(200);
    expect(bootstrap.json()).toEqual({
      user: {
        id: dependencies.user.id,
        locale: "en",
        timezone: "UTC",
      },
      activeSession: null,
      dueFollowUpSessionId: null,
      wakeSchedule: null,
    });
    await app.close();
  });

  it("returns no profile for invalid launch data or a missing app session", async () => {
    const dependencies = createMemoryDependencies();
    const app = await createApp(testConfig, {
      ...dependencies,
      now: () => testNow,
    });
    const auth = await app.inject({
      method: "POST",
      url: "/api/v1/auth/telegram",
      payload: { initData: `${signedInitData()}tampered` },
    });
    expect(auth.statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/v1/bootstrap" })).statusCode).toBe(401);
    await app.close();
  });
});
