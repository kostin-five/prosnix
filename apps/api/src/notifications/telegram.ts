import type { NotificationResult } from "@awc/domain";

interface TelegramResponse {
  ok?: boolean;
  result?: { message_id?: number };
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

export interface TelegramNotificationGateway {
  send(input: {
    kind: "wake" | "follow_up";
    chatId: bigint;
    attempt: number;
    now: Date;
  }): Promise<NotificationResult>;
}

export class TelegramBotGateway implements TelegramNotificationGateway {
  constructor(
    private readonly token: string,
    private readonly webAppUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async send(input: {
    kind: "wake" | "follow_up";
    chatId: bigint;
    attempt: number;
    now: Date;
  }): Promise<NotificationResult> {
    let response: Response;
    try {
      response = await this.fetcher(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: input.chatId.toString(),
          text:
            input.kind === "wake"
              ? "Доброе утро! Пора запустить твой протокол пробуждения ☀️"
              : "Как ты себя чувствуешь спустя 15 минут? Ответ поможет улучшить твой следующий протокол.",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: input.kind === "wake" ? "Начать пробуждение" : "Ответить на follow-up",
                  web_app: { url: this.webAppUrl },
                },
              ],
            ],
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { status: "ambiguous", errorCode: "network" };
    }

    let body: TelegramResponse;
    try {
      body = (await response.json()) as TelegramResponse;
    } catch {
      return { status: "ambiguous", errorCode: "invalid_response" };
    }
    if (response.ok && body.ok && Number.isSafeInteger(body.result?.message_id)) {
      return {
        status: "sent",
        telegramMessageId: BigInt(body.result!.message_id!),
        sentAt: input.now,
      };
    }
    if (response.status === 429 && input.attempt < 2) {
      const delay = Math.max(1, Math.min(300, body.parameters?.retry_after ?? 30));
      return {
        status: "retry_wait",
        retryAt: new Date(input.now.getTime() + delay * 1000),
        errorCode: "rate_limited",
      };
    }
    if (
      response.status === 403 ||
      /bot was blocked|user is deactivated|chat not found/i.test(body.description ?? "")
    ) {
      return { status: "blocked", errorCode: "bot_blocked" };
    }
    if (response.status >= 500) {
      return { status: "ambiguous", errorCode: "telegram_5xx" };
    }
    return { status: "failed", errorCode: "telegram_4xx" };
  }
}
