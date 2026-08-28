import type { FastifyInstance } from "fastify";

import type { UserDeletionRepository } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "./require-session.js";

export async function registerDeleteUserRoute(
  app: FastifyInstance,
  options: { config: AppConfig; repository: UserDeletionRepository; now?: () => Date },
): Promise<void> {
  app.delete("/api/v1/me", async (request, reply) => {
    const now = options.now?.() ?? new Date();
    const userId = authenticatedUserId(request, options.config, now);
    if (!userId) return reply.status(401).send({ code: "authentication_required" });
    await options.repository.deleteUser(userId, request.id, now);
    reply.clearCookie("awc_session", { path: "/" });
    return reply.status(204).send();
  });
}
