import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";

import type {
  AnalyticsRepository,
  BootstrapRepository,
  SessionCommandRepository,
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

export interface AppDependencies {
  unitOfWork: UnitOfWork;
  bootstrapRepository: BootstrapRepository;
  sessionCommands?: SessionCommandRepository;
  analyticsRepository?: AnalyticsRepository;
  userDeletionRepository?: UserDeletionRepository;
  wakeScheduleRepository?: WakeScheduleRepository;
  wakeNotificationRepository?: WakeNotificationRepository;
  notificationGateway?: TelegramNotificationGateway;
  now?: () => Date;
}

export async function createApp(
  config: AppConfig,
  dependencies?: AppDependencies,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.nodeEnv !== "test",
  });

  await app.register(cookie, {
    secret: config.sessionSecret || "development-only-session-secret-32",
    hook: "onRequest",
  });

  app.get("/health", async () => ({ status: "ok" }));
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
    if (dependencies.analyticsRepository) {
      await registerAnalyticsRoutes(app, {
        config,
        repository: dependencies.analyticsRepository,
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
