import { createHash } from "node:crypto";

import {
  SessionCommandConflict,
  type FollowUpNotificationRepository,
  type UnitOfWork,
} from "@awc/domain";
import type { SessionService } from "../sessions/service.js";
import type { TelegramNotificationGateway } from "./telegram.js";

const callbackPattern =
  /^fu:1:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(u|b|d)$/i;
const outcomes = { u: "up", b: "back", d: "drowsy" } as const;

export interface FollowUpCallback {
  id?: string;
  data?: string;
  from?: { id?: number };
  message?: { message_id?: number; chat?: { id?: number } };
}

export class FollowUpCallbackHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly repository: FollowUpNotificationRepository,
    private readonly sessions: SessionService,
    private readonly telegram: TelegramNotificationGateway,
  ) {}

  async handle(callback: FollowUpCallback): Promise<void> {
    if (!callback.id) return;
    const match = callback.data?.match(callbackPattern);
    const telegramUserId = callback.from?.id;
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;
    if (
      !match ||
      !Number.isSafeInteger(telegramUserId) ||
      telegramUserId! <= 0 ||
      chatId !== telegramUserId ||
      !Number.isSafeInteger(messageId) ||
      messageId! <= 0
    ) {
      await this.telegram.answerCallbackQuery?.(callback.id, "Открой приложение, чтобы ответить.");
      return;
    }

    const sessionId = match[1]!.toLowerCase();
    const outcome = outcomes[match[2]!.toLowerCase() as keyof typeof outcomes];
    const user = await this.unitOfWork.transaction(({ users }) =>
      users.findByTelegramId(BigInt(telegramUserId!)),
    );
    const sent =
      user && (await this.repository.findSentMessage?.(user.id, sessionId, BigInt(messageId!)));
    if (!sent) {
      await this.telegram.answerCallbackQuery?.(callback.id, "Открой приложение, чтобы ответить.");
      return;
    }

    let alreadySaved = false;
    try {
      const operationId = `tgfu-${createHash("sha256").update(callback.id).digest("hex")}`;
      const result = await this.sessions.execute(user.id, operationId, {
        type: "follow_up",
        sessionId,
        outcome,
      });
      alreadySaved = result.replayed;
    } catch (error) {
      if (!(error instanceof SessionCommandConflict)) throw error;
      if (error.canonicalSession?.id !== sessionId || error.canonicalSession.followUp === null) {
        await this.telegram.answerCallbackQuery?.(
          callback.id,
          "Открой приложение, чтобы ответить.",
        );
        return;
      }
      alreadySaved = true;
    }
    await this.telegram.answerCallbackQuery?.(
      callback.id,
      alreadySaved ? "Ответ уже сохранён." : "Ответ сохранён. Спасибо!",
    );
    await this.telegram.removeInlineKeyboard?.(BigInt(chatId!), messageId!);
  }
}
