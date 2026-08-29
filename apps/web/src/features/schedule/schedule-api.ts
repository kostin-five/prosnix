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
