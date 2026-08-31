import type { FastifyInstance } from "fastify";

import type { UnitOfWork } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { createAppSessionToken } from "./app-session.js";
import { TelegramAuthError, validateTelegramInitData } from "./telegram.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; unitOfWork: UnitOfWork; now?: () => Date },
): Promise<void> {
  app.post<{ Body: { initData?: string } }>(
    "/api/v1/auth/telegram",
    {
      config: {
        rateLimit: {
          max: options.config.authRateLimitMax,
          timeWindow: "1 minute",
        },
      },
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["initData"],
          properties: { initData: { type: "string", minLength: 1, maxLength: 8 * 1024 } },
        },
      },
    },
    async (request, reply) => {
      let launch;
      try {
        const validationNow = options.now?.();
        launch = validateTelegramInitData(request.body.initData ?? "", {
          botToken: options.config.botToken,
          maxAgeSeconds: options.config.telegramAuthMaxAgeSeconds,
          ...(validationNow ? { now: validationNow } : {}),
        });
      } catch (error) {
        if (error instanceof TelegramAuthError) {
          return reply.status(401).send({ error: "telegram_auth_failed" });
        }
        throw error;
      }

      const user = await options.unitOfWork.transaction(async ({ users }) => {
        const telegramUserId = BigInt(launch.user.id);
        return (
          (await users.findByTelegramId(telegramUserId)) ??
          users.createFromTelegram({
            telegramUserId,
            ...(launch.user.languageCode ? { locale: launch.user.languageCode } : {}),
          })
        );
      });
      const sessionNow = options.now?.();
      const token = createAppSessionToken(
        user.id,
        options.config.sessionSecret,
        sessionNow ? { now: sessionNow } : {},
      );
      reply.setCookie("awc_session", token, {
        httpOnly: true,
        secure: options.config.nodeEnv === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      return reply.status(204).send();
    },
  );
}
