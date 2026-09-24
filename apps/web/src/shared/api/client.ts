export type WakeContext = "night_sleep" | "short_nap" | "long_nap" | "energy_reset";
export type WakeDurationMinutes = 2 | 5 | 10;
export interface WakeProfile {
  movementLevel: "none" | "light" | "full";
  availableResources: Array<
    "water" | "bright_light" | "floor_space" | "wash_access" | "active_movement"
  >;
  excludedTaskIds: string[];
  defaultDurationMinutes: WakeDurationMinutes;
  onboardingCompleted: boolean;
  revision: number;
}
export interface WakeRoutineItem {
  id: string;
  title: string;
}
export interface WakeRoutine {
  enabled: boolean;
  items: WakeRoutineItem[];
  revision: number;
}
export interface WakeRoutineRun {
  sessionId: string;
  items: WakeRoutineItem[];
  completedItemIds: string[];
  revision: number;
  completedAt: string | null;
}

export interface BootstrapResponse {
  user: { id: string; locale: string | null; timezone: string };
  activeSession: null | {
    session: {
      id: string;
      status: "assigned" | "in_progress";
      currentStepIndex: number;
      version: number;
      wakeContext: WakeContext | "unspecified";
      durationMinutes: WakeDurationMinutes;
      personalization: {
        profileRevision: number;
        movementLevel: "none" | "light" | "full";
        availableResources: string[];
        excludedTaskIds: string[];
        fallbackReason: "none" | "profile_missing" | "limited_eligible_tasks";
      };
      sessionKind?: "primary" | "recovery";
      parentSessionId?: string | null;
      recoveryBaseline?: { sessionId: string; ratingKind: "post_protocol" } | null;
      recoveryOffer?: RecoveryOfferResponse | null;
      experience?: { soundMode: "unknown" | "off" | "on" };
    };
    protocol: {
      key: string;
      version: number;
      title: string;
      steps: Array<{ index: number; taskId: string; category?: string }>;
      effectiveSteps?: Array<{ index: number; taskId: string; category?: string }>;
    };
    assignment: {
      strategyVersion: string;
      phase: "learning" | "adaptive" | "fallback";
      hypothesis: string;
    };
    baseline: number | null;
    postRating: number | null;
    substitutions?: SessionTaskSubstitutionResponse[];
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
  wakeProfile: WakeProfile;
  wakeRoutine: WakeRoutine;
}

export interface WakeSessionResponse {
  id: string;
  userId: string;
  status: "assigned" | "in_progress" | "protocol_completed" | "abandoned";
  currentStepIndex: number;
  version: number;
  wakeContext: WakeContext | "unspecified";
  durationMinutes: WakeDurationMinutes;
  personalization: {
    profileRevision: number;
    movementLevel: "none" | "light" | "full";
    availableResources: string[];
    excludedTaskIds: string[];
    fallbackReason: "none" | "profile_missing" | "limited_eligible_tasks";
  };
  sessionKind?: "primary" | "recovery";
  parentSessionId?: string | null;
  recoveryBaseline?: { sessionId: string; ratingKind: "post_protocol" } | null;
  recoveryOffer?: RecoveryOfferResponse | null;
  experience?: { soundMode: "unknown" | "off" | "on" };
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
  effectiveSteps?: WakeSessionResponse["assignment"]["steps"];
  substitutions?: SessionTaskSubstitutionResponse[];
  baseline: number | null;
  tasks: Array<{
    stepIndex: number;
    taskId: string;
    category: "cognitive" | "movement" | "behavioral" | "environment";
    correct: number;
    total: number;
    durationMs: number;
    difficultyLevel?: number;
    observedAt: string;
  }>;
  postRating: number | null;
  followUp: "up" | "back" | "drowsy" | null;
  startedAt: string | null;
  protocolCompletedAt: string | null;
  followUpDueAt: string | null;
  abandonedAt: string | null;
}

export interface SessionTaskSubstitutionResponse {
  id: string;
  stepIndex: number;
  originalTaskId: string;
  replacementTaskId: string;
  reason: "unwilling_now" | "not_helpful" | "cannot_do";
  operationId: string;
  createdAt: string;
}

export interface RecoveryOfferResponse {
  status: "eligible" | "declined" | "accepted";
  maxDurationSeconds: 90;
  recoverySessionId: string | null;
}

export interface MetricResponse {
  key: string;
  value: number | null;
  evidenceCount: number;
  evidenceIds: string[];
  confidence: "insufficient" | "low" | "medium" | "high";
}

export interface AnalyticsProfileResponse {
  methodVersion: "analytics-v1" | "analytics-v2";
  computedAt: string;
  averageDelta: MetricResponse;
  riseSuccess: MetricResponse;
  protocolEffects: MetricResponse[];
  factorEffects: MetricResponse[];
  comparisonProgress?: Array<{
    key: string;
    factorKey: string;
    groupKey: string;
    withCount: number;
    withoutCount: number;
    pairCount: number;
    targetPairs: 3;
    status: "collecting" | "ready";
  }>;
  sequenceEffects: MetricResponse[];
  dailyTrend?: Array<{
    localDate: string;
    averageDelta: number;
    evidenceCount: number;
    sessionIds: string[];
  }>;
}

export interface CoachInsightResponse {
  status: "ready" | "confirmation_required" | "unavailable";
  evidenceCount: number;
  cached: boolean;
  source: "provider" | "cache" | "fallback";
  limitReached: boolean;
  refreshAvailableAt: string;
  insight: null | {
    summary: string;
    nextExperiment: string;
    caveat: string;
    confidence: "insufficient" | "low" | "medium" | "high";
    generatedAt: string;
  };
}

export interface SessionHistoryItemResponse {
  id: string;
  completedAt: string;
  baseline: number;
  postRating: number;
  followUp: "up" | "back" | "drowsy" | null;
  durationMs: number | null;
  tasks: Array<{
    taskId: string;
    category: "cognitive" | "movement" | "behavioral" | "environment";
  }>;
  wakeContext: WakeContext | "unspecified";
  durationMinutes: WakeDurationMinutes;
  sessionKind: "primary" | "recovery";
  parentSessionId: string | null;
}

export interface SessionHistoryResponse {
  sessions: SessionHistoryItemResponse[];
}

export interface ExperimentFeedbackStatus {
  eligible: boolean;
  submitted: boolean;
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

export async function loadCoachInsight(confirmEarly = false): Promise<CoachInsightResponse> {
  const response = await expectSuccess(
    await fetch("/api/v1/coach/insight", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmEarly }),
    }),
  );
  return (await response.json()) as CoachInsightResponse;
}

export async function loadSessionHistory(limit = 10): Promise<SessionHistoryResponse> {
  const response = await expectSuccess(
    await fetch(`/api/v1/sessions/history?limit=${limit}`, { credentials: "same-origin" }),
  );
  return (await response.json()) as SessionHistoryResponse;
}

export async function loadExperimentFeedbackStatus(): Promise<ExperimentFeedbackStatus> {
  const response = await expectSuccess(
    await fetch("/api/v1/experiment-feedback", { credentials: "same-origin" }),
  );
  return (await response.json()) as ExperimentFeedbackStatus;
}

export async function submitExperimentFeedback(input: {
  helpful: number;
  irritating: number;
  continueIntent: number;
}): Promise<ExperimentFeedbackStatus> {
  const response = await expectSuccess(
    await fetch("/api/v1/experiment-feedback", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return (await response.json()) as ExperimentFeedbackStatus;
}

export async function deleteProfile(): Promise<void> {
  await expectSuccess(await fetch("/api/v1/me", { method: "DELETE", credentials: "same-origin" }));
}

export interface LegalStatusResponse {
  privacyVersion: string;
  termsVersion: string;
  accepted: boolean;
  acceptedAt: string | null;
}

export async function loadLegalStatus(): Promise<LegalStatusResponse> {
  const response = await expectSuccess(
    await fetch("/api/v1/legal/status", { credentials: "same-origin" }),
  );
  return (await response.json()) as LegalStatusResponse;
}

export async function acceptLegalDocuments(input: {
  privacyVersion: string;
  termsVersion: string;
}): Promise<void> {
  await expectSuccess(
    await fetch("/api/v1/legal/accept", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
