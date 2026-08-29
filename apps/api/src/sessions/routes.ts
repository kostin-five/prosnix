import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  FollowUpInputSchema,
  RatingInputSchema,
  TaskResultInputSchema,
  type FollowUpInput,
  type RatingInput,
  type TaskResultInput,
} from "@awc/contracts";
import { SessionCommandConflict, type SessionCommand } from "@awc/domain";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";
import { SessionService } from "./service.js";

interface SessionParams {
  sessionId: string;
}
interface StepParams extends SessionParams {
  stepIndex: string;
}

function operationId(request: FastifyRequest): string | null {
  const value = request.headers["idempotency-key"];
  return typeof value === "string" && value.length >= 8 && value.length <= 128 ? value : null;
}

function expectedVersion(request: FastifyRequest): number | null {
  const value = request.headers["if-match"];
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const version = Number(value);
  return Number.isSafeInteger(version) && version >= 1 ? version : null;
}

async function execute(
  request: FastifyRequest,
  reply: FastifyReply,
  options: { config: AppConfig; service: SessionService; now: () => Date },
  command: SessionCommand,
) {
  const userId = authenticatedUserId(request, options.config, options.now());
  if (!userId) return reply.status(401).send({ code: "authentication_required" });
  const key = operationId(request);
  if (!key) return reply.status(400).send({ code: "idempotency_key_required" });
  try {
    const result = await options.service.execute(userId, key, command);
    request.log.info(
      {
        event: "wake_session_transition",
        commandType: command.type,
        sessionStatus: result.session.status,
        sessionVersion: result.session.version,
        replayed: result.replayed,
      },
      "wake session transition accepted",
    );
    return reply.status(result.responseStatus).send(result.session);
  } catch (error) {
    if (error instanceof SessionCommandConflict) {
      request.log.warn(
        {
          event: "wake_session_transition_conflict",
          commandType: command.type,
          conflictCode: error.code,
        },
        "wake session transition rejected",
      );
      return reply.status(409).send({
        code: error.code,
        message: error.message,
        canonicalSession: error.canonicalSession,
      });
    }
    throw error;
  }
}

export async function registerSessionRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; service: SessionService; now?: () => Date },
): Promise<void> {
  const now = options.now ?? (() => new Date());

  app.post<{ Body: { timezone: string } }>(
    "/api/v1/sessions",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["timezone"],
          properties: { timezone: { type: "string", minLength: 1, maxLength: 100 } },
        },
      },
    },
    (request, reply) =>
      execute(
        request,
        reply,
        { ...options, now },
        {
          type: "create",
          timezone: request.body.timezone,
        },
      ),
  );

  app.put<{ Params: SessionParams; Body: RatingInput }>(
    "/api/v1/sessions/:sessionId/baseline",
    { schema: { body: RatingInputSchema } },
    (request, reply) => {
      const version = expectedVersion(request);
      if (!version) return reply.status(400).send({ code: "expected_version_required" });
      return execute(
        request,
        reply,
        { ...options, now },
        {
          type: "baseline",
          sessionId: request.params.sessionId,
          expectedVersion: version,
          value: request.body.value,
          ...(request.body.clientObservedAt
            ? { clientObservedAt: request.body.clientObservedAt }
            : {}),
        },
      );
    },
  );

  app.put<{ Params: StepParams; Body: TaskResultInput }>(
    "/api/v1/sessions/:sessionId/steps/:stepIndex",
    { schema: { body: TaskResultInputSchema } },
    (request, reply) => {
      const version = expectedVersion(request);
      const stepIndex = Number(request.params.stepIndex);
      if (!version) return reply.status(400).send({ code: "expected_version_required" });
      if (!Number.isInteger(stepIndex) || stepIndex < 0) {
        return reply.status(400).send({ code: "invalid_step_index" });
      }
      return execute(
        request,
        reply,
        { ...options, now },
        {
          type: "task",
          sessionId: request.params.sessionId,
          expectedVersion: version,
          stepIndex,
          ...request.body,
        },
      );
    },
  );

  app.put<{ Params: SessionParams; Body: RatingInput }>(
    "/api/v1/sessions/:sessionId/post-rating",
    { schema: { body: RatingInputSchema } },
    (request, reply) => {
      const version = expectedVersion(request);
      if (!version) return reply.status(400).send({ code: "expected_version_required" });
      return execute(
        request,
        reply,
        { ...options, now },
        {
          type: "post_rating",
          sessionId: request.params.sessionId,
          expectedVersion: version,
          value: request.body.value,
          ...(request.body.clientObservedAt
            ? { clientObservedAt: request.body.clientObservedAt }
            : {}),
        },
      );
    },
  );

  app.put<{ Params: SessionParams; Body: FollowUpInput }>(
    "/api/v1/sessions/:sessionId/follow-up",
    { schema: { body: FollowUpInputSchema } },
    (request, reply) =>
      execute(
        request,
        reply,
        { ...options, now },
        {
          type: "follow_up",
          sessionId: request.params.sessionId,
          outcome: request.body.outcome,
        },
      ),
  );

  app.post<{ Params: SessionParams }>("/api/v1/sessions/:sessionId/abandon", (request, reply) => {
    const version = expectedVersion(request);
    if (!version) return reply.status(400).send({ code: "expected_version_required" });
    return execute(
      request,
      reply,
      { ...options, now },
      {
        type: "abandon",
        sessionId: request.params.sessionId,
        expectedVersion: version,
      },
    );
  });
}
