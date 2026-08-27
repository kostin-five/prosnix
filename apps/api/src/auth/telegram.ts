import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

export interface ValidatedTelegramLaunch {
  authDate: Date;
  queryId?: string;
  user: TelegramUser;
}

export interface TelegramValidationOptions {
  botToken: string;
  now?: Date;
  maxAgeSeconds: number;
}

export class TelegramAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramAuthError";
  }
}

function parseUser(value: string): TelegramUser {
  let input: unknown;
  try {
    input = JSON.parse(value);
  } catch {
    throw new TelegramAuthError("Telegram user data is invalid");
  }
  if (typeof input !== "object" || input === null) {
    throw new TelegramAuthError("Telegram user data is invalid");
  }
  const user = input as Record<string, unknown>;
  if (!Number.isSafeInteger(user.id) || typeof user.first_name !== "string") {
    throw new TelegramAuthError("Telegram user identity is invalid");
  }
  return {
    id: user.id as number,
    firstName: user.first_name,
    ...(typeof user.last_name === "string" ? { lastName: user.last_name } : {}),
    ...(typeof user.username === "string" ? { username: user.username } : {}),
    ...(typeof user.language_code === "string"
      ? { languageCode: user.language_code }
      : {}),
  };
}

export function validateTelegramInitData(
  initData: string,
  options: TelegramValidationOptions,
): ValidatedTelegramLaunch {
  if (!options.botToken) {
    throw new TelegramAuthError("Telegram authentication is unavailable");
  }
  const params = new URLSearchParams(initData);
  const hashes = params.getAll("hash");
  if (hashes.length !== 1 || !/^[a-f\d]{64}$/i.test(hashes[0] ?? "")) {
    throw new TelegramAuthError("Telegram signature is missing or invalid");
  }
  const suppliedHash = hashes[0] as string;
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData")
    .update(options.botToken)
    .digest();
  const expectedHash = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest();
  if (!timingSafeEqual(Buffer.from(suppliedHash, "hex"), expectedHash)) {
    throw new TelegramAuthError("Telegram signature is invalid");
  }

  const authDateSeconds = Number(params.get("auth_date"));
  if (!Number.isSafeInteger(authDateSeconds) || authDateSeconds <= 0) {
    throw new TelegramAuthError("Telegram authentication date is invalid");
  }
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const ageSeconds = nowSeconds - authDateSeconds;
  if (ageSeconds > options.maxAgeSeconds) {
    throw new TelegramAuthError("Telegram launch data has expired");
  }
  if (ageSeconds < -30) {
    throw new TelegramAuthError("Telegram authentication date is in the future");
  }

  const userValue = params.get("user");
  if (!userValue) {
    throw new TelegramAuthError("Telegram user identity is missing");
  }
  return {
    authDate: new Date(authDateSeconds * 1000),
    ...(params.get("query_id") ? { queryId: params.get("query_id") as string } : {}),
    user: parseUser(userValue),
  };
}
