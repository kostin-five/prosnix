export interface BootstrapResponse {
  user: { id: string; locale: string | null; timezone: string };
  activeSession: null | {
    session: {
      id: string;
      status: "assigned" | "in_progress";
      currentStepIndex: number;
      version: number;
    };
    protocol: {
      key: string;
      version: number;
      title: string;
      steps: Array<{ index: number; taskId: string; category?: string }>;
    };
    assignment: {
      strategyVersion: string;
      phase: "learning" | "adaptive" | "fallback";
      hypothesis: string;
    };
    baseline: number | null;
    postRating: number | null;
  };
  dueFollowUpSessionId: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function expectSuccess(response: Response): Promise<Response> {
  if (response.ok) return response;
  throw new ApiError(response.status, `Сервер вернул ошибку ${response.status}`);
}

export async function authenticateTelegram(initData: string): Promise<void> {
  await expectSuccess(
    await fetch("/api/v1/auth/telegram", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData }),
    }),
  );
}

export async function loadBootstrap(): Promise<BootstrapResponse> {
  const response = await expectSuccess(
    await fetch("/api/v1/bootstrap", { credentials: "same-origin" }),
  );
  return (await response.json()) as BootstrapResponse;
}
