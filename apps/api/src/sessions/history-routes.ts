import type { FastifyInstance } from "fastify";

import type { SessionHistoryResponse } from "@awc/contracts";
import type { SessionHistoryRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";

export async function registerSessionHistoryRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; repository: SessionHistoryRepository; now?: () => Date },
): Promise<void> {
  app.get<{ Querystring: { limit?: string } }>(
    "/api/v1/sessions/history",
    async (request, reply) => {
      const userId = authenticatedUserId(request, options.config, options.now?.() ?? new Date());
      if (!userId) return reply.status(401).send({ code: "authentication_required" });
      const requested = Number(request.query.limit ?? 10);
      const limit = Number.isInteger(requested) ? Math.max(1, Math.min(20, requested)) : 10;
      const sessions = await options.repository.listCompleted(userId, limit);
      return {
        sessions: sessions.map((session) => ({
          ...session,
          completedAt: session.completedAt.toISOString(),
        })),
      } satisfies SessionHistoryResponse;
    },
  );
}
