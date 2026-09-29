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
    sessionId?: string;
    lifeGoal?: string | undefined;
    attempt: number;
    now: Date;
  }): Promise<NotificationResult>;
  answerCallbackQuery?(callbackId: string, text: string): Promise<boolean>;
  removeInlineKeyboard?(chatId: bigint, messageId: number): Promise<boolean>;
}

export class TelegramBotGateway implements TelegramNotificationGateway {
  constructor(
    private readonly token: string,
    private readonly webAppUrl: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly quickFollowUpEnabled = false,
  ) {}

  private async callbackMethod(method: string, body: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await this.fetcher(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5_000),
      });
      const payload = (await response.json()) as TelegramResponse;
      return response.ok && payload.ok === true;
    } catch {
      return false;
    }
  }

  answerCallbackQuery(callbackId: string, message: string): Promise<boolean> {
    return this.callbackMethod("answerCallbackQuery", {
      callback_query_id: callbackId,
      text: message,
      show_alert: false,
    });
  }

  removeInlineKeyboard(chatId: bigint, messageId: number): Promise<boolean> {
    return this.callbackMethod("editMessageReplyMarkup", {
      chat_id: chatId.toString(),
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  }

  async send(input: {
    kind: "wake" | "follow_up";
    chatId: bigint;
    sessionId?: string;
    lifeGoal?: string | undefined;
    attempt: number;
    now: Date;
  }): Promise<NotificationResult> {
    const appUrl = new URL(this.webAppUrl);
    appUrl.searchParams.set("source", input.kind === "wake" ? "wake" : "follow_up");
    const quickFollowUp =
      input.kind === "follow_up" &&
      this.quickFollowUpEnabled &&
      typeof input.sessionId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.sessionId);
    const quickButtons = quickFollowUp
      ? [
          { text: "Встал и не лёг", callback_data: `fu:1:${input.sessionId}:u` },
          { text: "Снова лёг", callback_data: `fu:1:${input.sessionId}:b` },
          { text: "Не лёг, но сонный", callback_data: `fu:1:${input.sessionId}:d` },
        ]
      : null;
    let response: Response;
    try {
      response = await this.fetcher(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: input.chatId.toString(),
          text:
            input.kind === "wake"
              ? `Доброе утро! Пора запустить твой протокол пробуждения ☀️${input.lifeGoal ? `\n\nТвоя жизненная цель: ${input.lifeGoal}` : ""}`
              : "Что произошло через 15 минут после пробуждения? Ответ поможет подобрать следующий протокол.",
          reply_markup: {
            inline_keyboard: quickButtons
              ? quickButtons.map((button) => [button])
              : [
                  [
                    {
                      text: input.kind === "wake" ? "Начать пробуждение" : "Ответить на follow-up",
                      web_app: { url: appUrl.toString() },
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
