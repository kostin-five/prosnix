import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";

import type { AppConfig } from "./config.js";

export async function createApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.nodeEnv !== "test",
    disableRequestLogging: true,
  });

  await app.register(cookie, {
    secret: config.sessionSecret || "development-only-session-secret-32",
    hook: "onRequest",
  });

  app.get("/health", async () => ({ status: "ok" }));

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
