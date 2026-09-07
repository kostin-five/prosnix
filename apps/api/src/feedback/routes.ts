import type { FastifyInstance } from "fastify";

import { ExperimentFeedbackInputSchema, type ExperimentFeedbackInput } from "@awc/contracts";
import type { ExperimentFeedbackRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";

export async function registerExperimentFeedbackRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; repository: ExperimentFeedbackRepository; now?: () => Date },
): Promise<void> {
  const now = options.now ?? (() => new Date());
  app.get("/api/v1/experiment-feedback", async (request, reply) => {
    const userId = authenticatedUserId(request, options.config, now());
    if (!userId) return reply.status(401).send({ code: "authentication_required" });
    return options.repository.status(userId);
  });
  app.post<{ Body: ExperimentFeedbackInput }>(
    "/api/v1/experiment-feedback",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: { body: ExperimentFeedbackInputSchema },
    },
    async (request, reply) => {
      const submittedAt = now();
      const userId = authenticatedUserId(request, options.config, submittedAt);
      if (!userId) return reply.status(401).send({ code: "authentication_required" });
      const status = await options.repository.submit({ userId, ...request.body, now: submittedAt });
      if (!status.eligible) return reply.status(409).send({ code: "feedback_not_eligible" });
      return status;
    },
  );
}
