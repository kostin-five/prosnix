import { describe, expect, it, vi } from "vitest";

import { TelegramBotGateway } from "../../src/notifications/telegram.js";

describe("Telegram notification gateway", () => {
  it("returns a confirmed message id", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ ok: true, result: { message_id: 123 } }),
    ) as unknown as typeof fetch;
    const gateway = new TelegramBotGateway("token", "https://example.com/", fetcher);
    await expect(
      gateway.send({ chatId: 42n, attempt: 1, now: new Date("2026-08-29T04:00:00Z") }),
    ).resolves.toEqual({
      status: "sent",
      telegramMessageId: 123n,
      sentAt: new Date("2026-08-29T04:00:00Z"),
    });
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
      gateway.send({ chatId: 42n, attempt: 1, now: new Date("2026-08-29T04:00:00Z") }),
    ).resolves.toMatchObject({ status: "retry_wait", errorCode: "rate_limited" });
    await expect(
      gateway.send({ chatId: 42n, attempt: 2, now: new Date("2026-08-29T04:00:00Z") }),
    ).resolves.toEqual({ status: "failed", errorCode: "telegram_4xx" });
  });

  it("classifies blocked and ambiguous outcomes without exposing the response", async () => {
    const blocked = vi.fn(async () =>
      Response.json({ ok: false, description: "Forbidden: bot was blocked" }, { status: 403 }),
    ) as unknown as typeof fetch;
    await expect(
      new TelegramBotGateway("token", "https://example.com/", blocked).send({
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
        chatId: 42n,
        attempt: 1,
        now: new Date(),
      }),
    ).resolves.toEqual({ status: "ambiguous", errorCode: "network" });
  });
});
