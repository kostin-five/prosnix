import type { FastifyInstance } from "fastify";

import type { AnalyticsRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";

export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  options: {
    config: AppConfig;
    repository: AnalyticsRepository;
    now?: () => Date;
  },
): Promise<void> {
  app.get("/api/v1/analytics/profile", async (request, reply) => {
    const now = options.now?.() ?? new Date();
    const userId = authenticatedUserId(request, options.config, now);
    if (!userId) {
      return reply.status(401).send({ code: "authentication_required" });
    }
    return options.repository.recompute(userId, now);
  });
}
