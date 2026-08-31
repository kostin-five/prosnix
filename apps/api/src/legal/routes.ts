import type { FastifyInstance } from "fastify";

import { LegalAcceptanceInputSchema } from "@awc/contracts";
import type { LegalAcceptanceRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";

export async function registerLegalRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; repository: LegalAcceptanceRepository; now?: () => Date },
): Promise<void> {
  app.get("/api/v1/legal/status", async (request, reply) => {
    const userId = authenticatedUserId(request, options.config, options.now?.() ?? new Date());
    if (!userId) return reply.status(401).send({ error: "authentication_required" });
    const record = await options.repository.find(userId);
    const accepted =
      record?.privacyVersion === options.config.legalPrivacyVersion &&
      record.termsVersion === options.config.legalTermsVersion;
    return {
      privacyVersion: options.config.legalPrivacyVersion,
      termsVersion: options.config.legalTermsVersion,
      accepted,
      acceptedAt: accepted ? record.acceptedAt.toISOString() : null,
    };
  });

  app.post(
    "/api/v1/legal/accept",
    { schema: { body: LegalAcceptanceInputSchema } },
    async (request, reply) => {
      const now = options.now?.() ?? new Date();
      const userId = authenticatedUserId(request, options.config, now);
      if (!userId) return reply.status(401).send({ error: "authentication_required" });
      const body = request.body as { privacyVersion: string; termsVersion: string };
      if (
        body.privacyVersion !== options.config.legalPrivacyVersion ||
        body.termsVersion !== options.config.legalTermsVersion
      ) {
        return reply.status(409).send({ error: "legal_version_changed" });
      }
      await options.repository.accept({ userId, ...body, acceptedAt: now });
      return reply.status(204).send();
    },
  );
}
