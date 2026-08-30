import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

import type {
  FollowUpNotificationRepository,
  NotificationMaintenanceRepository,
  WakeNotificationRepository,
} from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { dispatchWakeNotifications } from "./dispatch.js";
import type { DispatchEvent, DispatchSummary } from "./dispatch.js";
import { dispatchFollowUpNotifications } from "./follow-up-dispatch.js";
import type { TelegramNotificationGateway } from "./telegram.js";

interface DispatchRouteDependencies {
  config: AppConfig;
  repository: WakeNotificationRepository;
  followUpRepository?: FollowUpNotificationRepository;
  maintenanceRepository?: NotificationMaintenanceRepository;
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
  let running = false;
  app.post("/internal/notifications/dispatch", async (request, reply) => {
    reply.header("cache-control", "no-store");
    if (!dependencies.config.cronSecret || !dependencies.config.telegramWebAppUrl) {
      return reply.status(503).send({ error: "notification_dispatch_not_configured" });
    }
    if (!bearerMatches(request.headers.authorization, dependencies.config.cronSecret)) {
      return reply.header("www-authenticate", "Bearer").status(401).send({ error: "unauthorized" });
    }
    if (running) {
      return reply.status(409).send({ error: "notification_dispatch_already_running" });
    }

    running = true;
    const startedMs = Date.now();
    const runNow = dependencies.now?.() ?? new Date();
    const onEvent = (event: DispatchEvent) =>
      request.log.info(event, "notification dispatch event");
    try {
      const [wake, followUp] = await Promise.all([
        dispatchWakeNotifications(dependencies.repository, dependencies.gateway, {
          now: runNow,
          limit: 10,
          concurrency: 5,
          onEvent,
        }),
        dependencies.followUpRepository
          ? dispatchFollowUpNotifications(dependencies.followUpRepository, dependencies.gateway, {
              now: runNow,
              limit: 10,
              concurrency: 5,
              onEvent,
            })
          : Promise.resolve(emptySummary()),
      ]);
      const maintenance = dependencies.maintenanceRepository
        ? await dependencies.maintenanceRepository.pruneBefore(
            new Date(runNow.getTime() - 90 * 24 * 60 * 60_000),
          )
        : { wakeDeleted: 0, followUpDeleted: 0 };
      const total = mergeSummaries(wake, followUp);
      const summary = {
        wake,
        followUp,
        total,
        maintenance,
        durationMs: Math.max(0, Date.now() - startedMs),
        maxLagMs: total.maxLagMs,
      };
      request.log.info({ ...summary }, "notification dispatch completed");
      return reply.send(summary);
    } finally {
      running = false;
    }
  });
}

function emptySummary(): DispatchSummary {
  return {
    claimed: 0,
    sent: 0,
    retryWait: 0,
    blocked: 0,
    failed: 0,
    skipped: 0,
    maxLagMs: 0,
  };
}

function mergeSummaries(left: DispatchSummary, right: DispatchSummary): DispatchSummary {
  return {
    claimed: left.claimed + right.claimed,
    sent: left.sent + right.sent,
    retryWait: left.retryWait + right.retryWait,
    blocked: left.blocked + right.blocked,
    failed: left.failed + right.failed,
    skipped: left.skipped + right.skipped,
    maxLagMs: Math.max(left.maxLagMs, right.maxLagMs),
  };
}
