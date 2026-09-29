import { describe, expect, it } from "vitest";

import type {
  BillingRepository,
  FollowUpNotificationRepository,
  LegalAcceptanceRepository,
} from "@awc/domain";
import { createApp } from "../../src/app/create-app.js";
import type { TelegramStarsGateway } from "../../src/billing/telegram-stars.js";
import type { TelegramNotificationGateway } from "../../src/notifications/telegram.js";
import { SessionService } from "../../src/sessions/service.js";
import {
  createMemoryDependencies,
  createMemorySessionCommands,
  testConfig,
  testNow,
} from "../helpers.js";

const sessionId = "00000000-0000-4000-8000-000000000100";
const callback = (id: string, userId = 42, messageId = 77, choice = "u") => ({
  callback_query: {
    id,
    from: { id: userId },
    message: { message_id: messageId, chat: { id: userId } },
    data: `fu:1:${sessionId}:${choice}`,
  },
});

async function setup() {
  const dependencies = createMemoryDependencies();
  const commands = createMemorySessionCommands(dependencies.user.id);
  const service = new SessionService(commands, () => testNow);
  let result = await service.execute(dependencies.user.id, "create", {
    type: "create",
    timezone: "UTC",
    wakeContext: "night_sleep",
    durationMinutes: 5,
  });
  for (const command of [
    { type: "baseline", value: 3 },
    { type: "task", stepIndex: 0, taskId: "math", correct: 1, total: 1, durationMs: 1000 },
    { type: "task", stepIndex: 1, taskId: "memory", correct: 1, total: 1, durationMs: 1000 },
    { type: "post_rating", value: 6 },
  ] as const) {
    result = await service.execute(dependencies.user.id, `step-${result.session.version}`, {
      ...command,
      sessionId,
      expectedVersion: result.session.version,
    });
  }
  const responses: string[] = [];
  const removals: number[] = [];
  const telegram: TelegramNotificationGateway = {
    send: async () => ({ status: "failed", errorCode: "telegram_4xx" }),
    answerCallbackQuery: async (_id, text) => {
      responses.push(text);
      return true;
    },
    removeInlineKeyboard: async (_chatId, messageId) => {
      removals.push(messageId);
      return true;
    },
  };
  const followUpNotificationRepository = {
    findSentMessage: async (userId: string, id: string, messageId: bigint) =>
      userId === dependencies.user.id && id === sessionId && messageId === 77n,
  } as FollowUpNotificationRepository;
  const billingRepository = {
    findSubscription: async () => null,
    createCheckout: async () => {
      throw new Error("unused");
    },
    setInvoiceUrl: async () => undefined,
    findCheckout: async () => null,
    checkoutBelongsToTelegramUser: async () => false,
    activate: async () => "rejected",
    updateSubscriptionState: async () => "rejected",
  } satisfies BillingRepository;
  const legalAcceptanceRepository = {} as LegalAcceptanceRepository;
  const telegramStarsGateway = {} as TelegramStarsGateway;
  const app = await createApp(testConfig, {
    ...dependencies,
    sessionCommands: commands,
    followUpNotificationRepository,
    notificationGateway: telegram,
    billingRepository,
    legalAcceptanceRepository,
    telegramStarsGateway,
    now: () => testNow,
  });
  const post = (payload: object, secret = testConfig.telegramWebhookSecret) =>
    app.inject({
      method: "POST",
      url: "/internal/telegram/webhook",
      headers: { "x-telegram-bot-api-secret-token": secret },
      payload,
    });
  return { app, post, service, dependencies, responses, removals };
}

describe("Telegram follow-up callback", () => {
  it("accepts one owner response and preserves it on repeats or later choices", async () => {
    const context = await setup();
    expect((await context.post(callback("first"))).statusCode).toBe(200);
    expect((await context.post(callback("first"))).statusCode).toBe(200);
    expect((await context.post(callback("second", 42, 77, "b"))).statusCode).toBe(200);
    await expect(
      context.service.execute(context.dependencies.user.id, "different", {
        type: "follow_up",
        sessionId,
        outcome: "back",
      }),
    ).rejects.toMatchObject({ canonicalSession: { followUp: "up" } });
    expect(context.removals).toEqual([77, 77, 77]);
    expect(context.responses).toEqual([
      "Ответ сохранён. Спасибо!",
      "Ответ уже сохранён.",
      "Ответ уже сохранён.",
    ]);
    await context.app.close();
  });

  it("rejects the wrong secret, user, message, and malformed callback", async () => {
    const context = await setup();
    expect((await context.post(callback("wrong-secret"), "wrong")).statusCode).toBe(401);
    await context.post(callback("wrong-user", 43));
    await context.post(callback("wrong-message", 42, 78));
    await context.post({
      callback_query: {
        ...callback("group").callback_query,
        message: { message_id: 77, chat: { id: -100 } },
      },
    });
    await context.post({ callback_query: { ...callback("bad").callback_query, data: "fu:1:bad" } });
    expect(context.removals).toEqual([]);
    expect(context.responses).toEqual([
      "Открой приложение, чтобы ответить.",
      "Открой приложение, чтобы ответить.",
      "Открой приложение, чтобы ответить.",
      "Открой приложение, чтобы ответить.",
    ]);
    await context.app.close();
  });
});
