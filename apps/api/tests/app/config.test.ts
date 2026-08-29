import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/app/config.js";

const production = {
  NODE_ENV: "production",
  TELEGRAM_BOT_TOKEN: "123456:test-token",
  SESSION_SECRET: "test-session-secret-that-is-longer-than-32-chars",
  DATABASE_URL: "postgres://example",
};

describe("application config", () => {
  it("allows the web API to start before a notification URL is configured", () => {
    expect(loadConfig(production).telegramWebAppUrl).toBe("");
  });

  it("requires HTTPS when a production notification URL is configured", () => {
    expect(() =>
      loadConfig({ ...production, TELEGRAM_WEB_APP_URL: "http://example.com/" }),
    ).toThrow("must use HTTPS");
    expect(
      loadConfig({ ...production, TELEGRAM_WEB_APP_URL: "https://wake-coach.example/" })
        .telegramWebAppUrl,
    ).toBe("https://wake-coach.example/");
  });
});
