import type { FastifyInstance } from "fastify";

export async function registerObservability(app: FastifyInstance): Promise<void> {
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        event: "http_request_completed",
        method: request.method,
        route: request.routeOptions.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
  });
}
