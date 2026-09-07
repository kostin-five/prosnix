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
      const terminalDeliveries =
        summary.deliveries.dailySent +
        summary.deliveries.followUpSent +
        summary.deliveries.failed +
        summary.deliveries.blocked;
      return {
        period: { days, from: from.toISOString(), to: now.toISOString() },
        computedAt: now.toISOString(),
        users: summary.users,
        sessions: {
          ...summary.sessions,
          completionRate: rate(summary.sessions.completed, summary.sessions.started),
        },
        funnel: {
          ...summary.funnel,
          startRate: rate(summary.funnel.started, summary.funnel.assigned),
          completionRate: rate(summary.funnel.completed, summary.funnel.started),
          followUpRate: rate(summary.funnel.followedUp, summary.funnel.completed),
        },
        wakeQuality: {
          ...summary.wakeQuality,
          improvedRate: rate(
            summary.wakeQuality.improvedSessions,
            summary.wakeQuality.pairedSessions,
          ),
        },
        followUp: {
          ...summary.followUp,
          responseRate: rate(summary.followUp.answered, summary.followUp.eligible),
          stayedUpRate: rate(summary.followUp.up, summary.followUp.answered),
        },
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
        timeline: summary.timeline,
        breakdowns: {
          contexts: summary.breakdowns.contexts.map((item) => ({
            ...item,
            completionRate: rate(item.completed, item.sessions),
          })),
          durations: summary.breakdowns.durations.map((item) => ({
            ...item,
            completionRate: rate(item.completed, item.sessions),
          })),
          experiments: summary.breakdowns.experiments.map((item) => ({
            ...item,
            completionRate: rate(item.completed, item.assigned),
          })),
          proInterest: summary.breakdowns.proInterest,
        },
        features: summary.features,
        deliveries: {
          ...summary.deliveries,
          terminal: terminalDeliveries,
          successRate: rate(
            summary.deliveries.dailySent + summary.deliveries.followUpSent,
            terminalDeliveries,
          ),
        },
        billing: {
          enabled: options.config.telegramStarsMonthlyPrice > 0,
          ...summary.billing,
        },
      };
    },
  );
}
