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
    expect(loadConfig(production).cronSecret).toBe("");
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

  it("rejects a weak cron secret without making it mandatory for API startup", () => {
    expect(() => loadConfig({ ...production, CRON_SECRET: "too-short" })).toThrow(
      "at least 32 characters",
    );
    expect(loadConfig({ ...production, CRON_SECRET: "c".repeat(32) }).cronSecret).toBe(
      "c".repeat(32),
    );
  });
});
