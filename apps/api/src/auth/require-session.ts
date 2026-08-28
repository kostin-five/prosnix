import type { FastifyRequest } from "fastify";

import type { AppConfig } from "../app/config.js";
import { verifyAppSessionToken } from "./app-session.js";

export function authenticatedUserId(
  request: FastifyRequest,
  config: AppConfig,
  now: Date,
): string | null {
  const token = request.cookies.awc_session;
  if (!token) return null;
  return verifyAppSessionToken(token, config.sessionSecret, now)?.userId ?? null;
}
