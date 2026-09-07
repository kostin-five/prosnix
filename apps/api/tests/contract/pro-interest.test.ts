import { describe, expect, it } from "vitest";

import type { ProInterestStatus } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

describe("контракт исследования интереса к Pro", () => {
  it("требует auth, валидирует связанный выбор и сохраняет ответ один раз", async () => {
    const dependencies = createMemoryDependencies();
    let status: ProInterestStatus = { eligible: false, submitted: false };
    const submit = async (): Promise<ProInterestStatus> => {
      if (!status.eligible) return status;
      status = { eligible: true, submitted: true };
      return status;
    };
    const app = await createApp(testConfig, {
      ...dependencies,
      proInterestRepository: { status: async () => status, submit },
      now: () => testNow,
    });
    expect((await app.inject({ url: "/api/v1/pro-interest" })).statusCode).toBe(401);
    const cookie = await authenticateTestUser(app);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/pro-interest",
          headers: { cookie },
          payload: { intent: "interested" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/pro-interest",
          headers: { cookie },
          payload: { intent: "not_now", interestFocus: "both" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/pro-interest",
          headers: { cookie },
          payload: { intent: "not_now" },
        })
      ).statusCode,
    ).toBe(409);
    status = { eligible: true, submitted: false };
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/pro-interest",
      headers: { cookie },
      payload: { intent: "interested", interestFocus: "both" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ eligible: true, submitted: true });
    expect((await app.inject({ url: "/api/v1/pro-interest", headers: { cookie } })).json()).toEqual(
      { eligible: true, submitted: true },
    );
    await app.close();
  });
});
