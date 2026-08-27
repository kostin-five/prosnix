import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { TelegramAuthError, validateTelegramInitData } from "../../src/auth/telegram.js";

const botToken = "123456:test-token";
const now = new Date("2026-08-27T06:00:00.000Z");

function signedInitData(values: Record<string, string>): string {
  const params = new URLSearchParams(values);
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("Telegram Mini App launch-data validation", () => {
  it("accepts a current, correctly signed Telegram user", () => {
    const initData = signedInitData({
      auth_date: String(Math.floor(now.getTime() / 1000) - 30),
      query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
      user: JSON.stringify({ id: 42, first_name: "Ada", language_code: "en" }),
    });

    expect(
      validateTelegramInitData(initData, {
        botToken,
        now,
        maxAgeSeconds: 900,
      }),
    ).toMatchObject({ user: { id: 42, languageCode: "en" } });
  });

  it("rejects launch data changed after it was signed", () => {
    const initData = signedInitData({
      auth_date: String(Math.floor(now.getTime() / 1000)),
      user: JSON.stringify({ id: 42, first_name: "Ada" }),
    }).replace("Ada", "Eve");

    expect(() =>
      validateTelegramInitData(initData, { botToken, now, maxAgeSeconds: 900 }),
    ).toThrowError(TelegramAuthError);
  });

  it("rejects correctly signed but expired launch data", () => {
    const initData = signedInitData({
      auth_date: String(Math.floor(now.getTime() / 1000) - 901),
      user: JSON.stringify({ id: 42, first_name: "Ada" }),
    });

    expect(() =>
      validateTelegramInitData(initData, { botToken, now, maxAgeSeconds: 900 }),
    ).toThrowError(/expired/i);
  });
});
