import type { WakeSessionResponse } from "../../shared/api/client.js";
import { sendSessionCommand } from "./session-api.js";

export function startRecoverySession(
  sessionId: string,
  expectedVersion: number,
): Promise<WakeSessionResponse> {
  return sendSessionCommand(
    "POST",
    `/api/v1/sessions/${sessionId}/recovery`,
    null,
    expectedVersion,
  );
}

export function declineRecoverySession(
  sessionId: string,
  expectedVersion: number,
): Promise<WakeSessionResponse> {
  return sendSessionCommand(
    "POST",
    `/api/v1/sessions/${sessionId}/recovery/decline`,
    null,
    expectedVersion,
  );
}
