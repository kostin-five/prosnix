import type { FastifyInstance } from "fastify";
import type { CoachInsightRequest } from "@awc/contracts";

import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";
import type { CoachService } from "./service.js";

export async function registerCoachRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; service: CoachService; now?: () => Date },
): Promise<void> {
  app.post<{ Body?: unknown }>(
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
      const body = request.body ?? {};
      if (
        typeof body !== "object" ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => key !== "confirmEarly") ||
        ("confirmEarly" in body && typeof body.confirmEarly !== "boolean")
      ) {
        return reply.status(400).send({ code: "invalid_coach_insight_request" });
      }
      const input = body as CoachInsightRequest;
      const earlyConfirmed = input.confirmEarly === true;
      const result = await options.service.getInsight(userId, now, {
        confirmEarly: earlyConfirmed,
      });
      request.log.info(
        {
          event: "coach_insight_completed",
          status: result.status,
          cached: result.cached,
          source: result.source,
          limitReached: result.limitReached,
          evidenceCount: result.evidenceCount,
          earlyConfirmed,
          latencyMs: Date.now() - startedAt,
        },
        "coach insight completed",
      );
      return result;
    },
  );
}
