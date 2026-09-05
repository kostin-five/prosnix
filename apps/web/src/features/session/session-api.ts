import {
  ApiError,
  type WakeContext,
  type WakeDurationMinutes,
  type WakeSessionResponse,
} from "../../shared/api/client.js";
import { removeSessionDraft, saveSessionDraft, type SessionDraft } from "./draft-store.js";

export class SessionConflictError extends ApiError {
  constructor(
    readonly code: string,
    readonly canonicalSession: WakeSessionResponse | null,
  ) {
    super(409, "Сессия изменилась на другом устройстве");
    this.name = "SessionConflictError";
  }
}

async function sendCommand(
  method: "POST" | "PUT",
  path: string,
  body: unknown,
  expectedVersion?: number,
): Promise<WakeSessionResponse> {
  const operationId = crypto.randomUUID();
  const draft: SessionDraft = {
    operationId,
    method,
    path,
    body,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    createdAt: new Date().toISOString(),
  };
  await saveSessionDraft(draft);

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        "idempotency-key": operationId,
        ...(body === null ? {} : { "content-type": "application/json" }),
        ...(expectedVersion === undefined ? {} : { "if-match": String(expectedVersion) }),
      },
      ...(body === null ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new Error("Нет соединения. Действие пока не подтверждено сервером.", {
      cause: error,
    });
  }

  await removeSessionDraft(operationId);
  const payload = (await response.json()) as
    WakeSessionResponse | { code?: string; canonicalSession?: WakeSessionResponse | null };
  if (response.status === 409) {
    const conflict = payload as {
      code?: string;
      canonicalSession?: WakeSessionResponse | null;
    };
    throw new SessionConflictError(
      conflict.code ?? "session_conflict",
      conflict.canonicalSession ?? null,
    );
  }
  if (!response.ok) {
    const code = "code" in payload && typeof payload.code === "string" ? payload.code : null;
    const message =
      code === "expected_version_required"
        ? "Сессия изменилась. Открой приложение заново."
        : code === "idempotency_key_required"
          ? "Не удалось безопасно подтвердить действие. Повтори попытку."
          : response.status === 401
            ? "Сессия Telegram истекла. Открой приложение из бота заново."
            : `Не удалось выполнить действие (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return payload as WakeSessionResponse;
}

export function createWakeSession(
  timezone: string,
  wakeContext: WakeContext,
  durationMinutes: WakeDurationMinutes,
): Promise<WakeSessionResponse> {
  return sendCommand("POST", "/api/v1/sessions", { timezone, wakeContext, durationMinutes });
}

export function saveBaseline(
  sessionId: string,
  expectedVersion: number,
  value: number,
): Promise<WakeSessionResponse> {
  return sendCommand(
    "PUT",
    `/api/v1/sessions/${sessionId}/baseline`,
    { value, clientObservedAt: new Date().toISOString() },
    expectedVersion,
  );
}

export function saveTaskResult(
  sessionId: string,
  expectedVersion: number,
  stepIndex: number,
  result: {
    taskId: string;
    correct: number;
    total: number;
    durationMs: number;
    difficultyLevel?: number;
  },
): Promise<WakeSessionResponse> {
  return sendCommand(
    "PUT",
    `/api/v1/sessions/${sessionId}/steps/${stepIndex}`,
    result,
    expectedVersion,
  );
}

export function savePostRating(
  sessionId: string,
  expectedVersion: number,
  value: number,
): Promise<WakeSessionResponse> {
  return sendCommand(
    "PUT",
    `/api/v1/sessions/${sessionId}/post-rating`,
    { value, clientObservedAt: new Date().toISOString() },
    expectedVersion,
  );
}

export function saveFollowUp(
  sessionId: string,
  outcome: "up" | "back" | "drowsy",
): Promise<WakeSessionResponse> {
  return sendCommand("PUT", `/api/v1/sessions/${sessionId}/follow-up`, { outcome });
}

export function abandonWakeSession(
  sessionId: string,
  expectedVersion: number,
): Promise<WakeSessionResponse> {
  return sendCommand("POST", `/api/v1/sessions/${sessionId}/abandon`, null, expectedVersion);
}
