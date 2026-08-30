export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  botToken: string;
  sessionSecret: string;
  telegramAuthMaxAgeSeconds: number;
  telegramWebAppUrl: string;
  cronSecret: string;
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
  };
}
