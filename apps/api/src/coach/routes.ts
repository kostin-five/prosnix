import type { FastifyInstance } from "fastify";

import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";
import type { CoachService } from "./service.js";

export async function registerCoachRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; service: CoachService; now?: () => Date },
): Promise<void> {
  app.get(
    "/api/v1/coach/insight",
    {
      config: {
        rateLimit: {
          max: options.config.coachRateLimitMax,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const now = options.now?.() ?? new Date();
      const userId = authenticatedUserId(request, options.config, now);
      if (!userId) return reply.status(401).send({ code: "authentication_required" });
      const startedAt = Date.now();
      const result = await options.service.getInsight(userId, now);
      request.log.info(
        {
          event: "coach_insight_completed",
          status: result.status,
          cached: result.cached,
          evidenceCount: result.evidenceCount,
          latencyMs: Date.now() - startedAt,
        },
        "coach insight completed",
      );
      return result;
    },
  );
}
