import { describe, expect, it, vi } from "vitest";

import { TelegramBotGateway } from "../../src/notifications/telegram.js";

describe("Telegram notification gateway", () => {
  it("returns a confirmed message id", async () => {
    let capturedRequest: RequestInit | undefined;
    const fetcher = vi.fn(async (_input: unknown, request?: RequestInit) => {
      capturedRequest = request;
      return Response.json({ ok: true, result: { message_id: 123 } });
    }) as unknown as typeof fetch;
    const gateway = new TelegramBotGateway("token", "https://example.com/", fetcher);
    await expect(
      gateway.send({
        kind: "wake",
        lifeGoal: "Построить своё дело",
        chatId: 42n,
        attempt: 1,
        now: new Date("2026-08-29T04:00:00Z"),
      }),
    ).resolves.toEqual({
      status: "sent",
      telegramMessageId: 123n,
      sentAt: new Date("2026-08-29T04:00:00Z"),
    });
    const body = JSON.parse(String(capturedRequest?.body)) as {
      text: string;
      reply_markup: { inline_keyboard: Array<Array<{ web_app: { url: string } }>> };
    };
    expect(body.reply_markup.inline_keyboard[0]?.[0]?.web_app.url).toBe(
      "https://example.com/?source=wake",
    );
    expect(body.text).toContain("Твоя жизненная цель: Построить своё дело");
  });

  it("retries an explicit rate limit only once", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        { ok: false, error_code: 429, parameters: { retry_after: 20 } },
        { status: 429 },
      ),
    ) as unknown as typeof fetch;
    const gateway = new TelegramBotGateway("token", "https://example.com/", fetcher);
    await expect(
      gateway.send({
        kind: "wake",
        chatId: 42n,
        attempt: 1,
        now: new Date("2026-08-29T04:00:00Z"),
      }),
    ).resolves.toMatchObject({ status: "retry_wait", errorCode: "rate_limited" });
    await expect(
      gateway.send({
        kind: "wake",
        chatId: 42n,
        attempt: 2,
        now: new Date("2026-08-29T04:00:00Z"),
      }),
    ).resolves.toEqual({ status: "failed", errorCode: "telegram_4xx" });
  });

  it("classifies blocked and ambiguous outcomes without exposing the response", async () => {
    const blocked = vi.fn(async () =>
      Response.json({ ok: false, description: "Forbidden: bot was blocked" }, { status: 403 }),
    ) as unknown as typeof fetch;
    await expect(
      new TelegramBotGateway("token", "https://example.com/", blocked).send({
        kind: "wake",
        chatId: 42n,
        attempt: 1,
        now: new Date(),
      }),
    ).resolves.toEqual({ status: "blocked", errorCode: "bot_blocked" });
    const network = vi.fn(async () => {
      throw new Error("secret transport details");
    }) as unknown as typeof fetch;
    await expect(
      new TelegramBotGateway("token", "https://example.com/", network).send({
        kind: "wake",
        chatId: 42n,
        attempt: 1,
        now: new Date(),
      }),
    ).resolves.toEqual({ status: "ambiguous", errorCode: "network" });
  });

  it("uses a dedicated follow-up message and button", async () => {
    let capturedRequest: RequestInit | undefined;
    const fetcher = (async (_input: unknown, request?: RequestInit) => {
      capturedRequest = request;
      return Response.json({ ok: true, result: { message_id: 321 } });
    }) as typeof fetch;
    const gateway = new TelegramBotGateway("token", "https://example.com/", fetcher);
    await gateway.send({ kind: "follow_up", chatId: 42n, attempt: 1, now: new Date() });

    const body = JSON.parse(String(capturedRequest?.body)) as {
      text: string;
      reply_markup: { inline_keyboard: Array<Array<{ text: string; web_app: { url: string } }>> };
    };
    expect(body.text).toContain("спустя 15 минут");
    expect(body.reply_markup.inline_keyboard[0]?.[0]?.text).toBe("Ответить на follow-up");
    expect(body.reply_markup.inline_keyboard[0]?.[0]?.web_app.url).toBe(
      "https://example.com/?source=follow_up",
    );
  });
});
