export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  botToken: string;
  sessionSecret: string;
  telegramAuthMaxAgeSeconds: number;
  telegramWebAppUrl: string;
  cronSecret: string;
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
  deepseekTimeoutMs: number;
  readinessTimeoutMs: number;
  shutdownTimeoutMs: number;
  authRateLimitMax: number;
  coachRateLimitMax: number;
  adminTelegramUserIds: readonly bigint[];
  legalPrivacyVersion: string;
  legalTermsVersion: string;
  telegramStarsMonthlyPrice: number;
  telegramWebhookSecret: string;
  billingRateLimitMax: number;
  wakeTaskCatalogV9Enabled: boolean;
  wakeTaskSubstitutionEnabled: boolean;
  wakeLowEffectRecoveryEnabled: boolean;
  wakeCombinationAnalyticsEnabled: boolean;
}

function boundedInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  if (!(["development", "test", "production"] as const).includes(nodeEnv as AppConfig["nodeEnv"])) {
    throw new Error("NODE_ENV must be development, test or production");
  }
  const port = Number(env.API_PORT ?? env.PORT ?? 3001);
  const telegramAuthMaxAgeSeconds = Number(env.TELEGRAM_AUTH_MAX_AGE_SECONDS ?? 900);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("API_PORT must be a valid port");
  }
  if (!Number.isInteger(telegramAuthMaxAgeSeconds) || telegramAuthMaxAgeSeconds < 1) {
    throw new Error("TELEGRAM_AUTH_MAX_AGE_SECONDS must be positive");
  }
  const botToken = env.TELEGRAM_BOT_TOKEN ?? "";
  const sessionSecret = env.SESSION_SECRET ?? "";
  const cronSecret = env.CRON_SECRET ?? "";
  const databaseUrl = env.DATABASE_URL ?? "postgres://awc:awc@localhost:5432/awc";
  const deepseekApiKey = env.DEEPSEEK_API_KEY ?? "";
  const deepseekBaseUrl = env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const deepseekModel = env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const deepseekTimeoutMs = Number(env.DEEPSEEK_TIMEOUT_MS ?? 12_000);
  const readinessTimeoutMs = boundedInteger(env, "READINESS_TIMEOUT_MS", 1_500, 100, 2_000);
  const shutdownTimeoutMs = boundedInteger(env, "SHUTDOWN_TIMEOUT_MS", 9_000, 1_000, 10_000);
  const authRateLimitMax = boundedInteger(env, "AUTH_RATE_LIMIT_MAX", 30, 1, 1_000);
  const coachRateLimitMax = boundedInteger(env, "COACH_RATE_LIMIT_MAX", 10, 1, 1_000);
  const billingRateLimitMax = boundedInteger(env, "BILLING_RATE_LIMIT_MAX", 10, 1, 100);
  const legalPrivacyVersion = env.LEGAL_PRIVACY_VERSION?.trim() || "2026-09-07";
  const legalTermsVersion = env.LEGAL_TERMS_VERSION?.trim() || "2026-09-07";
  const telegramStarsMonthlyPrice = boundedInteger(
    env,
    "TELEGRAM_STARS_MONTHLY_PRICE",
    0,
    0,
    100_000,
  );
  const telegramWebhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  const wakeTaskCatalogV9Enabled = env.WAKE_TASK_CATALOG_V9_ENABLED !== "false";
  const wakeTaskSubstitutionEnabled = env.WAKE_TASK_SUBSTITUTION_ENABLED !== "false";
  const wakeLowEffectRecoveryEnabled = env.WAKE_LOW_EFFECT_RECOVERY_ENABLED !== "false";
  const wakeCombinationAnalyticsEnabled = env.WAKE_COMBINATION_ANALYTICS_ENABLED === "true";
  const adminTelegramUserIds = (env.ADMIN_TELEGRAM_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (!/^\d+$/.test(value)) throw new Error("ADMIN_TELEGRAM_USER_IDS must contain numeric IDs");
      return BigInt(value);
    });
  const telegramWebAppUrl =
    env.TELEGRAM_WEB_APP_URL ?? (nodeEnv === "development" ? "http://localhost:5190/" : "");
  let parsedWebAppUrl: URL | null = null;
  if (telegramWebAppUrl) {
    try {
      parsedWebAppUrl = new URL(telegramWebAppUrl);
    } catch {
      throw new Error("TELEGRAM_WEB_APP_URL must be a valid URL");
    }
  }
  if (nodeEnv === "production" && (!botToken || sessionSecret.length < 32)) {
    throw new Error("Production authentication secrets are missing or unsafe");
  }
  if (cronSecret && cronSecret.length < 32) {
    throw new Error("CRON_SECRET must contain at least 32 characters");
  }
  if (telegramWebhookSecret && !/^[A-Za-z0-9_-]{32,256}$/.test(telegramWebhookSecret)) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET must contain 32-256 safe characters");
  }
  if (telegramStarsMonthlyPrice > 0 && !telegramWebhookSecret) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET is required when Telegram Stars billing is enabled");
  }
  if (telegramStarsMonthlyPrice > 0 && adminTelegramUserIds.length === 0) {
    throw new Error("ADMIN_TELEGRAM_USER_IDS is required when Telegram Stars billing is enabled");
  }
  if (telegramStarsMonthlyPrice > 0 && !parsedWebAppUrl) {
    throw new Error("TELEGRAM_WEB_APP_URL is required when Telegram Stars billing is enabled");
  }
  if (
    !Number.isInteger(deepseekTimeoutMs) ||
    deepseekTimeoutMs < 1_000 ||
    deepseekTimeoutMs > 30_000
  ) {
    throw new Error("DEEPSEEK_TIMEOUT_MS must be between 1000 and 30000");
  }
  let parsedDeepseekUrl: URL;
  try {
    parsedDeepseekUrl = new URL(deepseekBaseUrl);
  } catch {
    throw new Error("DEEPSEEK_BASE_URL must be a valid URL");
  }
  if (nodeEnv === "production" && parsedDeepseekUrl.protocol !== "https:") {
    throw new Error("DEEPSEEK_BASE_URL must use HTTPS in production");
  }
  if (nodeEnv === "production" && parsedWebAppUrl && parsedWebAppUrl.protocol !== "https:") {
    throw new Error("TELEGRAM_WEB_APP_URL must use HTTPS in production");
  }
  return {
    nodeEnv: nodeEnv as AppConfig["nodeEnv"],
    port,
    databaseUrl,
    botToken,
    sessionSecret,
    telegramAuthMaxAgeSeconds,
    telegramWebAppUrl: parsedWebAppUrl?.toString() ?? "",
    cronSecret,
    deepseekApiKey,
    deepseekBaseUrl: parsedDeepseekUrl.toString().replace(/\/$/, ""),
    deepseekModel,
    deepseekTimeoutMs,
    readinessTimeoutMs,
    shutdownTimeoutMs,
    authRateLimitMax,
    coachRateLimitMax,
    adminTelegramUserIds,
    legalPrivacyVersion,
    legalTermsVersion,
    telegramStarsMonthlyPrice,
    telegramWebhookSecret,
    billingRateLimitMax,
    wakeTaskCatalogV9Enabled,
    wakeTaskSubstitutionEnabled,
    wakeLowEffectRecoveryEnabled,
    wakeCombinationAnalyticsEnabled,
  };
}
