import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";

import type {
  BootstrapRepository,
  BootstrapSnapshot,
  Repositories,
  SessionCommandRepository,
  UnitOfWork,
  UserRecord,
} from "@awc/domain";
import {
  SessionCommandConflict,
  SessionCommandError,
  abandonSession,
  acceptBaseline,
  acceptFollowUp,
  acceptPostRating,
  acceptTaskResult,
  type WakeSession,
} from "@awc/domain";
import type { AppConfig } from "../src/app/config.js";

export const testNow = new Date("2026-08-27T06:00:00.000Z");
export const testBotToken = "123456:test-token";
export const testSessionSecret = "test-session-secret-that-is-longer-than-32-chars";

export const testConfig: AppConfig = {
  nodeEnv: "test",
  port: 3001,
  databaseUrl: "postgres://unused",
  botToken: testBotToken,
  sessionSecret: testSessionSecret,
  telegramAuthMaxAgeSeconds: 900,
  telegramWebAppUrl: "https://wake-coach.example/",
  cronSecret: "test-cron-secret-that-is-longer-than-32-chars",
  deepseekApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-flash",
  deepseekTimeoutMs: 12_000,
  readinessTimeoutMs: 1_500,
  shutdownTimeoutMs: 9_000,
  authRateLimitMax: 30,
  coachRateLimitMax: 10,
  adminTelegramUserIds: [42n],
  legalPrivacyVersion: "2026-08-31",
  legalTermsVersion: "2026-08-31",
  telegramStarsMonthlyPrice: 0,
  telegramWebhookSecret: "test-telegram-webhook-secret-32-chars",
  billingRateLimitMax: 10,
};

export function signedInitData(userId = 42): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(testNow.getTime() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "Ada", language_code: "en" }),
  });
  const check = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(testBotToken).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}

export function createMemoryDependencies(snapshot?: Partial<BootstrapSnapshot>): {
  unitOfWork: UnitOfWork;
  bootstrapRepository: BootstrapRepository;
  user: UserRecord;
} {
  const user: UserRecord = snapshot?.user ?? {
    id: "00000000-0000-4000-8000-000000000042",
    telegramUserId: 42n,
    locale: "en",
    timezone: "UTC",
    deletionRequestedAt: null,
  };
  const users = new Map<bigint, UserRecord>([[user.telegramUserId, user]]);
  const repositories = {
    users: {
      findByTelegramId: async (telegramUserId: bigint) => users.get(telegramUserId) ?? null,
      createFromTelegram: async (input: { telegramUserId: bigint; locale?: string }) => {
        const created = {
          ...user,
          telegramUserId: input.telegramUserId,
          locale: input.locale ?? null,
        };
        users.set(input.telegramUserId, created);
        return created;
      },
    },
    sessions: {
      findActiveForUser: async () => null,
      findOwnedById: async () => null,
      updateState: async () => null,
    },
    idempotency: {
      find: async () => null,
      save: async () => undefined,
    },
  } satisfies Repositories;
  return {
    user,
    unitOfWork: { transaction: (work) => work(repositories) },
    bootstrapRepository: {
      load: async (userId) =>
        userId === user.id
          ? {
              user,
              activeSession: snapshot?.activeSession ?? null,
              dueFollowUpSessionId: snapshot?.dueFollowUpSessionId ?? null,
              wakeSchedule: snapshot?.wakeSchedule ?? null,
            }
          : null,
    },
  };
}

export function cookieFrom(setCookie: string | string[] | undefined): string {
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!value) throw new Error("Expected authentication cookie");
  return value.split(";", 1)[0] as string;
}

export function createMemorySessionCommands(userId: string): SessionCommandRepository {
  let session: WakeSession | null = null;
  const results = new Map<
    string,
    { requestHash: string; result: Awaited<ReturnType<SessionCommandRepository["execute"]>> }
  >();

  return {
    async execute(envelope) {
      const stored = results.get(`${envelope.userId}:${envelope.operationId}`);
      if (stored) {
        if (stored.requestHash !== envelope.requestHash) {
          throw new SessionCommandConflict(
            "idempotency_conflict",
            "Ключ операции уже использован с другими данными",
            session,
          );
        }
        return { ...stored.result, replayed: true };
      }

      if (envelope.userId !== userId) {
        throw new SessionCommandConflict("session_not_found", "Сессия не найдена", null);
      }
      const observedAt = envelope.observedAt.toISOString();
      try {
        if (envelope.command.type === "create") {
          session ??= {
            id: "00000000-0000-4000-8000-000000000100",
            userId,
            assignment: {
              id: "00000000-0000-4000-8000-000000000101",
              protocolKey: "learning-cognitive",
              protocolVersion: 1,
              strategyVersion: "learning-v1",
              phase: "learning",
              hypothesis: "Проверяем когнитивный стартовый протокол",
              steps: [
                { index: 0, taskId: "math", category: "cognitive" },
                { index: 1, taskId: "memory", category: "cognitive" },
              ],
            },
            status: "assigned",
            currentStepIndex: 0,
            version: 1,
            baseline: null,
            tasks: [],
            postRating: null,
            followUp: null,
            startedAt: null,
            protocolCompletedAt: null,
            followUpDueAt: null,
            abandonedAt: null,
          };
        } else {
          if (!session || session.id !== envelope.command.sessionId) {
            throw new SessionCommandConflict("session_not_found", "Сессия не найдена", null);
          }
          const command = envelope.command;
          if (command.type === "baseline") {
            session = acceptBaseline(session, {
              expectedVersion: command.expectedVersion,
              value: command.value,
              observedAt,
            });
          } else if (command.type === "task") {
            session = acceptTaskResult(session, { ...command, observedAt });
          } else if (command.type === "post_rating") {
            session = acceptPostRating(session, {
              expectedVersion: command.expectedVersion,
              value: command.value,
              observedAt,
              followUpDelayMinutes: 15,
            });
          } else if (command.type === "follow_up") {
            session = acceptFollowUp(session, {
              expectedVersion: command.expectedVersion ?? session.version,
              outcome: command.outcome,
            });
          } else {
            session = abandonSession(session, {
              expectedVersion: command.expectedVersion,
              observedAt,
            });
          }
        }
      } catch (error) {
        if (error instanceof SessionCommandError) {
          throw new SessionCommandConflict(
            error.code === "stale_version" ? "stale_version" : "invalid_transition",
            error.message,
            session,
          );
        }
        throw error;
      }

      const result = {
        session,
        responseStatus: envelope.command.type === "create" ? (201 as const) : (200 as const),
        replayed: false,
      };
      results.set(`${envelope.userId}:${envelope.operationId}`, {
        requestHash: envelope.requestHash,
        result,
      });
      return result;
    },
  };
}

export async function authenticateTestUser(app: FastifyInstance): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/telegram",
    payload: { initData: signedInitData() },
  });
  return cookieFrom(response.headers["set-cookie"]);
}
