interface TelegramApiResponse<T = unknown> {
  ok?: boolean;
  result?: T;
  description?: string;
}

export interface TelegramStarsGateway {
  createMonthlyInvoice(input: { checkoutId: string; priceStars: number }): Promise<string>;
  answerPreCheckout(input: { queryId: string; ok: boolean; errorMessage?: string }): Promise<void>;
  sendPaySupport(input: {
    chatId: bigint;
    message: string;
    adminTelegramUserIds: readonly bigint[];
  }): Promise<void>;
  sendLegalLinks(chatId: bigint, webAppUrl: string): Promise<void>;
}

export class TelegramBotStarsGateway implements TelegramStarsGateway {
  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async call<T>(method: string, body: unknown): Promise<T> {
    const response = await this.fetcher(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || !payload.ok || payload.result === undefined) {
      throw new Error(`Telegram ${method} failed`);
    }
    return payload.result;
  }

  createMonthlyInvoice(input: { checkoutId: string; priceStars: number }): Promise<string> {
    return this.call<string>("createInvoiceLink", {
      title: "Prosnix Pro — 1 месяц",
      description: "Расширенная персонализация, история и еженедельные выводы.",
      payload: input.checkoutId,
      provider_token: "",
      currency: "XTR",
      prices: [{ label: "Prosnix Pro", amount: input.priceStars }],
      subscription_period: 30 * 24 * 60 * 60,
    });
  }

  async answerPreCheckout(input: {
    queryId: string;
    ok: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await this.call<boolean>("answerPreCheckoutQuery", {
      pre_checkout_query_id: input.queryId,
      ok: input.ok,
      ...(input.errorMessage ? { error_message: input.errorMessage } : {}),
    });
  }

  async sendPaySupport(input: {
    chatId: bigint;
    message: string;
    adminTelegramUserIds: readonly bigint[];
  }): Promise<void> {
    if (!input.message) {
      await this.call("sendMessage", {
        chat_id: input.chatId.toString(),
        text: "Чтобы обратиться по оплате, отправь команду /paysupport и описание проблемы. Не отправляй банковские данные или коды Telegram.",
      });
      return;
    }
    if (input.adminTelegramUserIds.length === 0) {
      await this.call("sendMessage", {
        chat_id: input.chatId.toString(),
        text: "Поддержка платежей пока не настроена. Платные функции Prosnix должны оставаться выключенными.",
      });
      return;
    }
    await Promise.all(
      input.adminTelegramUserIds.map((adminId) =>
        this.call("sendMessage", {
          chat_id: adminId.toString(),
          text: `Обращение по оплате Prosnix от Telegram ID ${input.chatId.toString()}:\n${input.message}`,
        }),
      ),
    );
    await this.call("sendMessage", {
      chat_id: input.chatId.toString(),
      text: "Обращение передано владельцу Prosnix. Ответ придёт в этом чате.",
    });
  }

  async sendLegalLinks(chatId: bigint, webAppUrl: string): Promise<void> {
    const termsUrl = new URL("/terms", webAppUrl).toString();
    const privacyUrl = new URL("/privacy", webAppUrl).toString();
    await this.call("sendMessage", {
      chat_id: chatId.toString(),
      text: `Условия использования Prosnix: ${termsUrl}\nПолитика конфиденциальности: ${privacyUrl}`,
    });
  }
}
