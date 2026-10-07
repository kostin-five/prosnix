import { apiFetch } from "../../shared/api/transport.js";
import { ApiError } from "../../shared/api/client.js";

export interface ProInterestStatus {
  eligible: boolean;
  submitted: boolean;
}

export type ProInterestInput = {
  intent: "interested" | "not_now" | "not_interested";
  interestFocus?: "long_history" | "deeper_experiments" | "both";
};

async function expectSuccess(response: Response): Promise<Response> {
  if (response.ok) return response;
  throw new ApiError(response.status, `Сервер вернул ошибку ${response.status}`);
}

export async function loadProInterestStatus(): Promise<ProInterestStatus> {
  const response = await expectSuccess(
    await apiFetch("/api/v1/pro-interest", { credentials: "same-origin" }),
  );
  return (await response.json()) as ProInterestStatus;
}

export async function submitProInterest(input: ProInterestInput): Promise<ProInterestStatus> {
  const response = await expectSuccess(
    await apiFetch("/api/v1/pro-interest", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return (await response.json()) as ProInterestStatus;
}
