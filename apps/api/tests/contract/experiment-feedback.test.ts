import { describe, expect, it } from "vitest";

import type { ExperimentFeedbackStatus } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

describe("контракт feedback эксперимента", () => {
  it("требует владельца, ждёт пять сессий и принимает ответ один раз", async () => {
    let status: ExperimentFeedbackStatus = { eligible: false, submitted: false };
    const submit = async (): Promise<ExperimentFeedbackStatus> => {
      if (status.eligible) status = { eligible: true, submitted: true };
      return status;
    };
    const app = await createApp(testConfig, {
      ...createMemoryDependencies(),
      experimentFeedbackRepository: { status: async () => status, submit },
      now: () => testNow,
    });

    expect((await app.inject({ url: "/api/v1/experiment-feedback" })).statusCode).toBe(401);
    const cookie = await authenticateTestUser(app);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/experiment-feedback",
          headers: { cookie },
          payload: { helpful: 5, irritating: 1, continueIntent: 5 },
        })
      ).statusCode,
    ).toBe(409);

    status = { eligible: true, submitted: false };
    const accepted = await app.inject({
      method: "POST",
      url: "/api/v1/experiment-feedback",
      headers: { cookie },
      payload: { helpful: 5, irritating: 1, continueIntent: 5 },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ eligible: true, submitted: true });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/experiment-feedback",
          headers: { cookie },
          payload: { helpful: 0, irritating: 1, continueIntent: 5 },
        })
      ).statusCode,
    ).toBe(400);
    await app.close();
  });
});
