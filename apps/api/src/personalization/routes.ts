import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  WakeProfileInputSchema,
  WakeRoutineInputSchema,
  WakeRoutineProgressInputSchema,
  type WakeProfileInput,
  type WakeRoutineInput,
  type WakeRoutineProgressInput,
} from "@awc/contracts";
import {
  eligibleWakeTasks,
  PersonalizationConflict,
  type WakePersonalizationRepository,
} from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";

function operationId(request: FastifyRequest): string | null {
  const value = request.headers["idempotency-key"];
  return typeof value === "string" && value.length >= 8 && value.length <= 128 ? value : null;
}
function revision(request: FastifyRequest): number | null {
  const value = request.headers["if-match"];
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
function conflict(error: unknown, reply: FastifyReply) {
  if (!(error instanceof PersonalizationConflict)) throw error;
  return reply
    .status(error.code === "session_not_found" ? 404 : 409)
    .send({ code: error.code, message: error.message });
}

export async function registerPersonalizationRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; repository: WakePersonalizationRepository; now?: () => Date },
): Promise<void> {
  const now = options.now ?? (() => new Date());
  const owner = (request: FastifyRequest) => authenticatedUserId(request, options.config, now());

  app.get("/api/v1/me/wake-profile", async (request, reply) => {
    const userId = owner(request);
    if (!userId) return reply.status(401).send({ code: "authentication_required" });
    return options.repository.loadProfile(userId);
  });
  app.put<{ Body: WakeProfileInput }>(
    "/api/v1/me/wake-profile",
    { schema: { body: WakeProfileInputSchema } },
    async (request, reply) => {
      const userId = owner(request);
      if (!userId) return reply.status(401).send({ code: "authentication_required" });
      const key = operationId(request);
      const expectedRevision = revision(request);
      if (!key) return reply.status(400).send({ code: "idempotency_key_required" });
      if (expectedRevision === null)
        return reply.status(400).send({ code: "expected_version_required" });
      if (eligibleWakeTasks({ ...request.body, revision: expectedRevision }).length === 0) {
        return reply.status(400).send({ code: "no_eligible_wake_tasks" });
      }
      try {
        return await options.repository.saveProfile({
          userId,
          expectedRevision,
          operationId: key,
          profile: {
            ...request.body,
            availableResources: [...request.body.availableResources],
            excludedTaskIds: [...request.body.excludedTaskIds],
          },
          now: now(),
        });
      } catch (error) {
        return conflict(error, reply);
      }
    },
  );

  app.get("/api/v1/me/wake-routine", async (request, reply) => {
    const userId = owner(request);
    if (!userId) return reply.status(401).send({ code: "authentication_required" });
    return options.repository.loadRoutine(userId);
  });
  app.put<{ Body: WakeRoutineInput }>(
    "/api/v1/me/wake-routine",
    { schema: { body: WakeRoutineInputSchema } },
    async (request, reply) => {
      const userId = owner(request);
      if (!userId) return reply.status(401).send({ code: "authentication_required" });
      const key = operationId(request);
      const expectedRevision = revision(request);
      if (!key) return reply.status(400).send({ code: "idempotency_key_required" });
      if (expectedRevision === null)
        return reply.status(400).send({ code: "expected_version_required" });
      const items = request.body.items.map((item) => ({ ...item, title: item.title.trim() }));
      if (
        items.some(({ title }) => title.length === 0) ||
        new Set(items.map(({ id }) => id)).size !== items.length
      )
        return reply.status(400).send({ code: "invalid_routine_items" });
      try {
        return await options.repository.saveRoutine({
          userId,
          expectedRevision,
          operationId: key,
          routine: { enabled: request.body.enabled, items },
          now: now(),
        });
      } catch (error) {
        return conflict(error, reply);
      }
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/api/v1/sessions/:sessionId/routine",
    async (request, reply) => {
      const userId = owner(request);
      if (!userId) return reply.status(401).send({ code: "authentication_required" });
      return { run: await options.repository.loadRoutineRun(userId, request.params.sessionId) };
    },
  );
  app.put<{ Params: { sessionId: string }; Body: WakeRoutineProgressInput }>(
    "/api/v1/sessions/:sessionId/routine",
    { schema: { body: WakeRoutineProgressInputSchema } },
    async (request, reply) => {
      const userId = owner(request);
      if (!userId) return reply.status(401).send({ code: "authentication_required" });
      const key = operationId(request);
      const expectedRevision = revision(request);
      if (!key) return reply.status(400).send({ code: "idempotency_key_required" });
      if (expectedRevision === null)
        return reply.status(400).send({ code: "expected_version_required" });
      try {
        return await options.repository.saveRoutineRun({
          userId,
          sessionId: request.params.sessionId,
          expectedRevision,
          operationId: key,
          completedItemIds: request.body.completedItemIds,
          now: now(),
        });
      } catch (error) {
        return conflict(error, reply);
      }
    },
  );
}
