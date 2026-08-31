import type { FastifyInstance } from "fastify";

import { WakeScheduleInputSchema, type WakeScheduleInput } from "@awc/contracts";
import type { AppConfig } from "../app/config.js";
import { authenticatedUserId } from "../auth/require-session.js";
import type { WakeScheduleService } from "./service.js";

export async function registerWakeScheduleRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; service: WakeScheduleService; now?: () => Date },
): Promise<void> {
  app.get("/api/v1/me/wake-schedule", async (request, reply) => {
    const userId = authenticatedUserId(request, options.config, options.now?.() ?? new Date());
    if (!userId) return reply.status(401).send({ error: "authentication_required" });
    return { schedule: await options.service.get(userId) };
  });

  app.put(
    "/api/v1/me/wake-schedule",
    { schema: { body: WakeScheduleInputSchema } },
    async (request, reply) => {
      const userId = authenticatedUserId(request, options.config, options.now?.() ?? new Date());
      if (!userId) return reply.status(401).send({ error: "authentication_required" });
      return options.service.save(userId, request.body as WakeScheduleInput);
    },
  );

  app.post("/api/v1/me/wake-schedule/snooze", async (request, reply) => {
    const userId = authenticatedUserId(request, options.config, options.now?.() ?? new Date());
    if (!userId) return reply.status(401).send({ error: "authentication_required" });
    const operationId = request.headers["idempotency-key"];
    if (typeof operationId !== "string" || operationId.length < 8 || operationId.length > 128) {
      return reply.status(400).send({ error: "idempotency_key_required" });
    }
    const schedule = await options.service.snooze(userId, operationId);
    request.log.info(
      { event: "wake_schedule_snoozed", revision: schedule.revision, delayMinutes: 5 },
      "wake schedule snoozed",
    );
    return schedule;
  });
}
