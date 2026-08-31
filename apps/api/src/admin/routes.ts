import type { FastifyInstance } from "fastify";

import type { AdminGrowthRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";

const periodValues = new Set([7, 30, 90]);
const rate = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));

export async function registerAdminRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; repository: AdminGrowthRepository; now?: () => Date },
): Promise<void> {
  app.get(
    "/api/v1/admin/growth",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const now = options.now?.() ?? new Date();
      const userId = authenticatedUserId(request, options.config, now);
      if (
        !userId ||
        !(await options.repository.isAllowed(userId, options.config.adminTelegramUserIds))
      ) {
        return reply.status(404).send({ error: "not_found" });
      }
      const rawDays = Number((request.query as { days?: string }).days ?? 7);
      if (!periodValues.has(rawDays)) return reply.status(400).send({ error: "invalid_period" });
      const days = rawDays as 7 | 30 | 90;
      const from = new Date(now.getTime() - days * 86_400_000);
      const summary = await options.repository.summarize(from, now);
      return {
        period: { days, from: from.toISOString(), to: now.toISOString() },
        computedAt: now.toISOString(),
        users: summary.users,
        sessions: {
          ...summary.sessions,
          completionRate: rate(summary.sessions.completed, summary.sessions.started),
        },
        followUp: summary.followUp,
        retention: {
          d1: {
            eligible: summary.retention.d1Eligible,
            retained: summary.retention.d1Retained,
            rate: rate(summary.retention.d1Retained, summary.retention.d1Eligible),
          },
          d7: {
            eligible: summary.retention.d7Eligible,
            retained: summary.retention.d7Retained,
            rate: rate(summary.retention.d7Retained, summary.retention.d7Eligible),
          },
        },
        deliveries: summary.deliveries,
        billing: {
          enabled: options.config.telegramStarsMonthlyPrice > 0,
          ...summary.billing,
        },
      };
    },
  );
}
