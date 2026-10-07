import { apiFetch } from "../../shared/api/transport.js";
import {
  ApiError,
  type WakeProfile,
  type WakeRoutine,
  type WakeRoutineRun,
} from "../../shared/api/client.js";

async function expectJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T;
  if (!response.ok) {
    throw new ApiError(response.status, `Не удалось загрузить данные (${response.status})`);
  }
  return payload;
}

async function save<T>(path: string, body: unknown, revision: number): Promise<T> {
  const response = await apiFetch(path, {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
      "if-match": String(revision),
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { code?: string };
  if (!response.ok) {
    const message =
      payload.code === "no_eligible_wake_tasks"
        ? "Оставь хотя бы одно подходящее задание"
        : response.status === 409
          ? "Данные изменились. Обнови экран и повтори."
          : `Не удалось сохранить (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return payload;
}

export function saveWakeProfile(
  profile: Omit<WakeProfile, "revision">,
  revision: number,
): Promise<WakeProfile> {
  return save("/api/v1/me/wake-profile", profile, revision);
}

export type LifeGoal = { text: string; revision: number };

export async function loadLifeGoal(): Promise<LifeGoal> {
  return expectJson<LifeGoal>(
    await apiFetch("/api/v1/me/life-goal", { credentials: "same-origin" }),
  );
}

export function saveLifeGoal(text: string, revision: number): Promise<LifeGoal> {
  return save("/api/v1/me/life-goal", { text }, revision);
}

export function saveWakeRoutine(
  routine: Omit<WakeRoutine, "revision">,
  revision: number,
): Promise<WakeRoutine> {
  return save("/api/v1/me/wake-routine", routine, revision);
}

export function saveWakeRoutineRun(
  sessionId: string,
  completedItemIds: string[],
  revision: number,
): Promise<WakeRoutineRun> {
  return save(`/api/v1/sessions/${sessionId}/routine`, { completedItemIds }, revision);
}

export async function loadWakeRoutineRun(sessionId: string): Promise<WakeRoutineRun | null> {
  const payload = await expectJson<{ run: WakeRoutineRun | null }>(
    await apiFetch(`/api/v1/sessions/${sessionId}/routine`, { credentials: "same-origin" }),
  );
  return payload.run;
}
