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
      wakeTaskCatalogV9Enabled: false,
    });
    expect(() =>
      loadConfig({ ...production, DEEPSEEK_BASE_URL: "http://api.deepseek.com" }),
    ).toThrow("must use HTTPS");
    expect(() => loadConfig({ ...production, DEEPSEEK_TIMEOUT_MS: "500" })).toThrow(
      "between 1000 and 30000",
    );
  });

  it("keeps the v9 wake-task catalog disabled unless explicitly enabled", () => {
    expect(
      loadConfig({ ...production, WAKE_TASK_CATALOG_V9_ENABLED: "true" }).wakeTaskCatalogV9Enabled,
    ).toBe(true);
    expect(
      loadConfig({ ...production, WAKE_TASK_CATALOG_V9_ENABLED: "false" }).wakeTaskCatalogV9Enabled,
    ).toBe(false);
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

  it("keeps billing fail-closed and validates admin IDs and webhook secret", () => {
    expect(loadConfig(production)).toMatchObject({
      adminTelegramUserIds: [],
      telegramStarsMonthlyPrice: 0,
      telegramWebhookSecret: "",
      billingRateLimitMax: 10,
    });
    expect(() => loadConfig({ ...production, ADMIN_TELEGRAM_USER_IDS: "42,wrong" })).toThrow(
      "numeric IDs",
    );
    expect(() => loadConfig({ ...production, TELEGRAM_STARS_MONTHLY_PRICE: "149" })).toThrow(
      "WEBHOOK_SECRET",
    );
    expect(() =>
      loadConfig({
        ...production,
        TELEGRAM_STARS_MONTHLY_PRICE: "149",
        TELEGRAM_WEBHOOK_SECRET: "w".repeat(32),
      }),
    ).toThrow("ADMIN_TELEGRAM_USER_IDS");
    expect(
      loadConfig({
        ...production,
        TELEGRAM_STARS_MONTHLY_PRICE: "149",
        TELEGRAM_WEBHOOK_SECRET: "w".repeat(32),
        ADMIN_TELEGRAM_USER_IDS: "42",
        TELEGRAM_WEB_APP_URL: "https://wake-coach.example/",
      }),
    ).toMatchObject({ telegramStarsMonthlyPrice: 149, adminTelegramUserIds: [42n] });
  });
});
