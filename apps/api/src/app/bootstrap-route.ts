import type { FastifyInstance } from "fastify";

import type { BootstrapRepository } from "@awc/domain";
import type { AppConfig } from "./config.js";
import { verifyAppSessionToken } from "../auth/app-session.js";

export async function registerBootstrapRoute(
  app: FastifyInstance,
  options: {
    config: AppConfig;
    bootstrapRepository: BootstrapRepository;
    now?: () => Date;
  },
): Promise<void> {
  app.get("/api/v1/bootstrap", async (request, reply) => {
    const token = request.cookies.awc_session;
    const now = options.now?.() ?? new Date();
    const claims = token
      ? verifyAppSessionToken(token, options.config.sessionSecret, now)
      : null;
    if (!claims) return reply.status(401).send({ error: "authentication_required" });

    const snapshot = await options.bootstrapRepository.load(claims.userId, now);
    if (!snapshot) return reply.status(401).send({ error: "authentication_required" });

    return {
      user: {
        id: snapshot.user.id,
        locale: snapshot.user.locale,
        timezone: snapshot.user.timezone,
      },
      activeSession: snapshot.activeSession,
      dueFollowUpSessionId: snapshot.dueFollowUpSessionId,
    };
  });
}
