import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import type {
  AnalyticsRepository,
  BootstrapRepository,
  CoachInsightRepository,
  FollowUpNotificationRepository,
  NotificationMaintenanceRepository,
  SessionCommandRepository,
  SessionHistoryRepository,
  UnitOfWork,
  UserDeletionRepository,
  WakeNotificationRepository,
  WakeScheduleRepository,
} from "@awc/domain";
import { registerAuthRoutes } from "../auth/routes.js";
import { registerBootstrapRoute } from "./bootstrap-route.js";
import { registerSessionRoutes } from "../sessions/routes.js";
import { SessionService } from "../sessions/service.js";
import { registerAnalyticsRoutes } from "../analytics/routes.js";
import { registerDeleteUserRoute } from "../auth/delete-route.js";
import type { AppConfig } from "./config.js";
import { registerObservability } from "../observability/register.js";
import { registerWakeScheduleRoutes } from "../notifications/routes.js";
import { WakeScheduleService } from "../notifications/service.js";
import { registerNotificationDispatchRoute } from "../notifications/dispatch-route.js";
import type { TelegramNotificationGateway } from "../notifications/telegram.js";
import { registerCoachRoutes } from "../coach/routes.js";
import { CoachService } from "../coach/service.js";
import type { CoachGateway } from "../coach/deepseek.js";
import { registerSessionHistoryRoutes } from "../sessions/history-routes.js";

export interface AppDependencies {
  unitOfWork: UnitOfWork;
  bootstrapRepository: BootstrapRepository;
  sessionCommands?: SessionCommandRepository;
  analyticsRepository?: AnalyticsRepository;
  coachInsightRepository?: CoachInsightRepository;
  coachGateway?: CoachGateway | null;
  sessionHistoryRepository?: SessionHistoryRepository;
  userDeletionRepository?: UserDeletionRepository;
  wakeScheduleRepository?: WakeScheduleRepository;
  wakeNotificationRepository?: WakeNotificationRepository;
  followUpNotificationRepository?: FollowUpNotificationRepository;
  notificationMaintenanceRepository?: NotificationMaintenanceRepository;
  notificationGateway?: TelegramNotificationGateway;
  readinessCheck?: () => Promise<void>;
  now?: () => Date;
}

async function readinessWithin(check: () => Promise<void>, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      check(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("readiness_timeout")), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function createApp(
  config: AppConfig,
  dependencies?: AppDependencies,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.nodeEnv !== "test",
    bodyLimit: 32 * 1024,
    // Render terminates public traffic at its proxy. Trust exactly that nearest hop so
    // request.ip (and therefore rate limiting) identifies clients instead of the proxy itself.
    trustProxy:
      config.nodeEnv === "production" ? (_address: string, hop: number) => hop === 0 : false,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
  });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({
      statusCode: 429,
      code: "rate_limit_exceeded",
      error: "Too Many Requests",
    }),
  });

  await app.register(cookie, {
    secret: config.sessionSecret || "development-only-session-secret-32",
    hook: "onRequest",
  });

  app.addHook("onSend", async (request, reply, payload) => {
    if (
      request.url.startsWith("/api/") ||
      request.url.startsWith("/internal/") ||
      request.url === "/health" ||
      request.url === "/ready"
    ) {
      reply.header("cache-control", "no-store");
    }
    return payload;
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (request, reply) => {
    if (!dependencies?.readinessCheck) {
      return reply.status(503).send({ error: "service_unavailable", requestId: request.id });
    }
    try {
      await readinessWithin(dependencies.readinessCheck, config.readinessTimeoutMs);
      return { status: "ready" };
    } catch {
      request.log.warn(
        { event: "readiness_failed", dependency: "database", requestId: request.id },
        "service is not ready",
      );
      return reply.status(503).send({ error: "service_unavailable", requestId: request.id });
    }
  });
  await registerObservability(app);

  if (dependencies) {
    await registerAuthRoutes(app, {
      config,
      unitOfWork: dependencies.unitOfWork,
      ...(dependencies.now ? { now: dependencies.now } : {}),
    });
    await registerBootstrapRoute(app, {
      config,
      bootstrapRepository: dependencies.bootstrapRepository,
      ...(dependencies.now ? { now: dependencies.now } : {}),
    });
    if (dependencies.sessionCommands) {
      await registerSessionRoutes(app, {
        config,
        service: new SessionService(
          dependencies.sessionCommands,
          dependencies.now ?? (() => new Date()),
        ),
        ...(dependencies.now ? { now: dependencies.now } : {}),
      });
    }
    if (dependencies.sessionHistoryRepository) {
      await registerSessionHistoryRoutes(app, {
        config,
        repository: dependencies.sessionHistoryRepository,
        ...(dependencies.now ? { now: dependencies.now } : {}),
      });
    }
    if (dependencies.analyticsRepository) {
      await registerAnalyticsRoutes(app, {
        config,
        repository: dependencies.analyticsRepository,
        ...(dependencies.now ? { now: dependencies.now } : {}),
      });
    }
    if (dependencies.analyticsRepository && dependencies.coachInsightRepository) {
      await registerCoachRoutes(app, {
        config,
        service: new CoachService(
          dependencies.analyticsRepository,
          dependencies.coachInsightRepository,
          dependencies.coachGateway ?? null,
        ),
        ...(dependencies.now ? { now: dependencies.now } : {}),
      });
    }
    if (dependencies.userDeletionRepository) {
      await registerDeleteUserRoute(app, {
        config,
        repository: dependencies.userDeletionRepository,
        ...(dependencies.now ? { now: dependencies.now } : {}),
      });
    }
    if (dependencies.wakeScheduleRepository) {
      await registerWakeScheduleRoutes(app, {
        config,
        service: new WakeScheduleService(
          dependencies.wakeScheduleRepository,
          dependencies.now ?? (() => new Date()),
        ),
        ...(dependencies.now ? { now: dependencies.now } : {}),
      });
    }
    if (dependencies.wakeNotificationRepository && dependencies.notificationGateway) {
      await registerNotificationDispatchRoute(app, {
        config,
        repository: dependencies.wakeNotificationRepository,
        ...(dependencies.followUpNotificationRepository
          ? { followUpRepository: dependencies.followUpNotificationRepository }
          : {}),
        ...(dependencies.notificationMaintenanceRepository
          ? { maintenanceRepository: dependencies.notificationMaintenanceRepository }
          : {}),
        gateway: dependencies.notificationGateway,
        ...(dependencies.now ? { now: dependencies.now } : {}),
      });
    }
  }

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, "request failed");
    const details =
      typeof error === "object" && error !== null
        ? (error as { statusCode?: unknown; code?: unknown })
        : {};
    const statusCode =
      typeof details.statusCode === "number" && details.statusCode < 500 ? details.statusCode : 500;
    void reply.status(statusCode).send({
      error:
        statusCode === 500
          ? "internal_error"
          : typeof details.code === "string"
            ? details.code
            : "request_error",
      requestId: request.id,
    });
  });

  return app;
}
