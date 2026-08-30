import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

import type { WakeNotificationRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { dispatchWakeNotifications } from "./dispatch.js";
import type { TelegramNotificationGateway } from "./telegram.js";

interface DispatchRouteDependencies {
  config: AppConfig;
  repository: WakeNotificationRepository;
  gateway: TelegramNotificationGateway;
  now?: () => Date;
}

function bearerMatches(header: string | undefined, expectedSecret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function registerNotificationDispatchRoute(
  app: FastifyInstance,
  dependencies: DispatchRouteDependencies,
): Promise<void> {
  app.post("/internal/notifications/dispatch", async (request, reply) => {
    reply.header("cache-control", "no-store");
    if (!dependencies.config.cronSecret || !dependencies.config.telegramWebAppUrl) {
      return reply.status(503).send({ error: "notification_dispatch_not_configured" });
    }
    if (!bearerMatches(request.headers.authorization, dependencies.config.cronSecret)) {
      return reply.header("www-authenticate", "Bearer").status(401).send({ error: "unauthorized" });
    }

    const summary = await dispatchWakeNotifications(dependencies.repository, dependencies.gateway, {
      now: dependencies.now?.() ?? new Date(),
      limit: 10,
      concurrency: 5,
      onEvent: (event) => request.log.info(event, "notification dispatch event"),
    });
    request.log.info({ ...summary }, "notification dispatch completed");
    return reply.send(summary);
  });
}
