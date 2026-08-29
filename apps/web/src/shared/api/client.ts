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
  wakeSchedule: null | {
    localTime: string;
    timezone: string;
    enabled: boolean;
    nextTriggerAt: string | null;
    botStatus: "unknown" | "available" | "blocked";
    revision: number;
  };
}

export interface WakeSessionResponse {
  id: string;
  userId: string;
  status: "assigned" | "in_progress" | "protocol_completed" | "abandoned";
  currentStepIndex: number;
  version: number;
  assignment: {
    id: string;
    protocolKey: string;
    protocolVersion: number;
    strategyVersion: string;
    phase: "learning" | "adaptive" | "fallback";
    hypothesis: string;
    steps: Array<{
      index: number;
      taskId: string;
      category: "cognitive" | "movement" | "behavioral" | "environment";
    }>;
  };
  baseline: number | null;
  tasks: Array<{
    stepIndex: number;
    taskId: string;
    category: "cognitive" | "movement" | "behavioral" | "environment";
    correct: number;
    total: number;
    durationMs: number;
    observedAt: string;
  }>;
  postRating: number | null;
  followUp: "up" | "back" | "drowsy" | null;
  startedAt: string | null;
  protocolCompletedAt: string | null;
  followUpDueAt: string | null;
  abandonedAt: string | null;
}

export interface MetricResponse {
  key: string;
  value: number | null;
  evidenceCount: number;
  evidenceIds: string[];
  confidence: "insufficient" | "low" | "medium" | "high";
}

export interface AnalyticsProfileResponse {
  methodVersion: "analytics-v1";
  computedAt: string;
  averageDelta: MetricResponse;
  riseSuccess: MetricResponse;
  protocolEffects: MetricResponse[];
  factorEffects: MetricResponse[];
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

export async function loadAnalyticsProfile(): Promise<AnalyticsProfileResponse> {
  const response = await expectSuccess(
    await fetch("/api/v1/analytics/profile", { credentials: "same-origin" }),
  );
  return (await response.json()) as AnalyticsProfileResponse;
}

export async function deleteProfile(): Promise<void> {
  await expectSuccess(await fetch("/api/v1/me", { method: "DELETE", credentials: "same-origin" }));
}
