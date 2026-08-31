import { describe, expect, it } from "vitest";

import type { LegalAcceptanceRecord } from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import { authenticateTestUser, createMemoryDependencies, testConfig, testNow } from "../helpers.js";

describe("legal acceptance contract", () => {
  it("requires authentication and versions explicit acceptance", async () => {
    const dependencies = createMemoryDependencies();
    let record: LegalAcceptanceRecord | null = null;
    const app = await createApp(testConfig, {
      ...dependencies,
      legalAcceptanceRepository: {
        find: async () => record,
        accept: async (input) => {
          record = input;
        },
      },
      now: () => testNow,
    });
    expect((await app.inject({ url: "/api/v1/legal/status" })).statusCode).toBe(401);
    const cookie = await authenticateTestUser(app);
    expect(
      (await app.inject({ url: "/api/v1/legal/status", headers: { cookie } })).json(),
    ).toMatchObject({ accepted: false, acceptedAt: null });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/legal/accept",
          headers: { cookie },
          payload: { privacyVersion: "old", termsVersion: testConfig.legalTermsVersion },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/legal/accept",
          headers: { cookie },
          payload: {
            privacyVersion: testConfig.legalPrivacyVersion,
            termsVersion: testConfig.legalTermsVersion,
          },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (await app.inject({ url: "/api/v1/legal/status", headers: { cookie } })).json(),
    ).toMatchObject({ accepted: true, acceptedAt: testNow.toISOString() });
    await app.close();
  });
});
