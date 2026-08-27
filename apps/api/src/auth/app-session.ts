import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

interface AppSessionClaims {
  userId: string;
  expiresAt: number;
  nonce: string;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createAppSessionToken(
  userId: string,
  secret: string,
  options: { now?: Date; ttlSeconds?: number } = {},
): string {
  if (secret.length < 32) throw new Error("Session secret must be at least 32 characters");
  const now = options.now ?? new Date();
  const claims: AppSessionClaims = {
    userId,
    expiresAt: Math.floor(now.getTime() / 1000) + (options.ttlSeconds ?? 30 * 24 * 60 * 60),
    nonce: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function verifyAppSessionToken(
  token: string,
  secret: string,
  now = new Date(),
): AppSessionClaims | null {
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return null;
  const expected = signature(payload, secret);
  const suppliedBuffer = Buffer.from(supplied, "base64url");
  if (suppliedBuffer.length !== expected.length || !timingSafeEqual(suppliedBuffer, expected)) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AppSessionClaims>;
    if (
      typeof claims.userId !== "string" ||
      typeof claims.nonce !== "string" ||
      !Number.isSafeInteger(claims.expiresAt) ||
      (claims.expiresAt as number) <= Math.floor(now.getTime() / 1000)
    ) {
      return null;
    }
    return claims as AppSessionClaims;
  } catch {
    return null;
  }
}
