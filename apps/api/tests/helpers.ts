import { createHmac } from "node:crypto";

import type {
  BootstrapRepository,
  BootstrapSnapshot,
  Repositories,
  UnitOfWork,
  UserRecord,
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
        const created = { ...user, telegramUserId: input.telegramUserId, locale: input.locale ?? null };
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
