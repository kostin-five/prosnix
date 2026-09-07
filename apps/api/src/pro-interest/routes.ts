import type { FastifyInstance } from "fastify";

import { ProInterestInputSchema, type ProInterestInput } from "@awc/contracts";
import type { ProInterestRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";

export async function registerProInterestRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; repository: ProInterestRepository; now?: () => Date },
): Promise<void> {
  const now = options.now ?? (() => new Date());
  app.get("/api/v1/pro-interest", async (request, reply) => {
    const userId = authenticatedUserId(request, options.config, now());
    if (!userId) return reply.status(401).send({ code: "authentication_required" });
    return options.repository.status(userId);
  });
  app.post<{ Body: ProInterestInput }>(
    "/api/v1/pro-interest",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: { body: ProInterestInputSchema },
    },
    async (request, reply) => {
      const submittedAt = now();
      const userId = authenticatedUserId(request, options.config, submittedAt);
      if (!userId) return reply.status(401).send({ code: "authentication_required" });
      const hasFocus = request.body.interestFocus !== undefined;
      if (
        (request.body.intent === "interested" && !hasFocus) ||
        (request.body.intent !== "interested" && hasFocus)
      ) {
        return reply.status(400).send({ code: "invalid_pro_interest_input" });
      }
      const status = await options.repository.submit({ userId, ...request.body, now: submittedAt });
      if (!status.eligible) return reply.status(409).send({ code: "pro_interest_not_eligible" });
      return status;
    },
  );
}
