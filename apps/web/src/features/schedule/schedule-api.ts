import { ApiError } from "../../shared/api/client.js";

export interface WakeSchedule {
  localTime: string;
  timezone: string;
  enabled: boolean;
  nextTriggerAt: string | null;
  botStatus: "unknown" | "available" | "blocked";
  revision: number;
}

async function expectSuccess(response: Response): Promise<Response> {
  if (response.ok) return response;
  throw new ApiError(response.status, `Не удалось сохранить напоминание (${response.status})`);
}

export async function loadWakeSchedule(): Promise<WakeSchedule | null> {
  const response = await expectSuccess(
    await fetch("/api/v1/me/wake-schedule", { credentials: "same-origin" }),
  );
  return ((await response.json()) as { schedule: WakeSchedule | null }).schedule;
}

export async function saveWakeSchedule(input: {
  localTime: string;
  timezone: string;
  enabled: boolean;
}): Promise<WakeSchedule> {
  const response = await expectSuccess(
    await fetch("/api/v1/me/wake-schedule", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return (await response.json()) as WakeSchedule;
}

export async function snoozeWakeSchedule(): Promise<WakeSchedule> {
  const response = await fetch("/api/v1/me/wake-schedule/snooze", {
    method: "POST",
    credentials: "same-origin",
    headers: { "idempotency-key": crypto.randomUUID() },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(
      response.status,
      response.status === 409
        ? payload?.error === "idempotency_conflict"
          ? "Не удалось безопасно повторить snooze. Нажми ещё раз."
          : "Сначала включи Telegram-напоминание в настройках."
        : `Не удалось отложить напоминание (${response.status})`,
    );
  }
  return (await response.json()) as WakeSchedule;
}
