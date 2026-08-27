import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";

import type { BootstrapRepository, UnitOfWork } from "@awc/domain";
import { registerAuthRoutes } from "../auth/routes.js";
import { registerBootstrapRoute } from "./bootstrap-route.js";
import type { AppConfig } from "./config.js";

export interface AppDependencies {
  unitOfWork: UnitOfWork;
  bootstrapRepository: BootstrapRepository;
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
  }

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, "request failed");
    const details =
      typeof error === "object" && error !== null
        ? (error as { statusCode?: unknown; code?: unknown })
        : {};
    const statusCode =
      typeof details.statusCode === "number" && details.statusCode < 500
        ? details.statusCode
        : 500;
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
