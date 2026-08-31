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

  it("keeps DeepSeek optional and validates its server-only transport", () => {
    expect(loadConfig(production)).toMatchObject({
      deepseekApiKey: "",
      deepseekBaseUrl: "https://api.deepseek.com",
      deepseekModel: "deepseek-v4-flash",
      deepseekTimeoutMs: 12_000,
    });
    expect(() =>
      loadConfig({ ...production, DEEPSEEK_BASE_URL: "http://api.deepseek.com" }),
    ).toThrow("must use HTTPS");
    expect(() => loadConfig({ ...production, DEEPSEEK_TIMEOUT_MS: "500" })).toThrow(
      "between 1000 and 30000",
    );
  });

  it("provides bounded readiness, shutdown and sensitive-route limits", () => {
    expect(loadConfig(production)).toMatchObject({
      readinessTimeoutMs: 1_500,
      shutdownTimeoutMs: 9_000,
      authRateLimitMax: 30,
      coachRateLimitMax: 10,
    });
    expect(() => loadConfig({ ...production, READINESS_TIMEOUT_MS: "0" })).toThrow(
      "READINESS_TIMEOUT_MS",
    );
    expect(() => loadConfig({ ...production, SHUTDOWN_TIMEOUT_MS: "11000" })).toThrow(
      "SHUTDOWN_TIMEOUT_MS",
    );
    expect(() => loadConfig({ ...production, AUTH_RATE_LIMIT_MAX: "1.5" })).toThrow(
      "AUTH_RATE_LIMIT_MAX",
    );
    expect(() => loadConfig({ ...production, COACH_RATE_LIMIT_MAX: "0" })).toThrow(
      "COACH_RATE_LIMIT_MAX",
    );
  });
});
