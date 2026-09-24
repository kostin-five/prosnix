export type TaskId =
  | "math"
  | "memory"
  | "stroop"
  | "reaction"
  | "steps"
  | "squats"
  | "shake"
  | "water"
  | "window"
  | "curtains"
  | "sit_edge"
  | "cool_wash"
  | "pushups";

export type TaskCategory = "cognitive" | "movement" | "behavioral" | "environment";
export type FollowUpOutcome = "up" | "back" | "drowsy";
export type SessionStatus = "assigned" | "in_progress" | "protocol_completed" | "abandoned";
export type SessionKind = "primary" | "recovery";
export type TaskSubstitutionReason = "unwilling_now" | "not_helpful" | "cannot_do";
export type WakeSoundMode = "unknown" | "off" | "on";
export type ExperimentPhase = "learning" | "adaptive" | "fallback";
export type Confidence = "insufficient" | "low" | "medium" | "high";
export type WakeContext = "unspecified" | "night_sleep" | "short_nap" | "long_nap" | "energy_reset";
export type WakeDurationMinutes = 2 | 5 | 10;
export type MovementLevel = "none" | "light" | "full";
export type WakeResource =
  "water" | "bright_light" | "floor_space" | "wash_access" | "active_movement";

export interface WakeCapabilityProfile {
  movementLevel: MovementLevel;
  availableResources: readonly WakeResource[];
  excludedTaskIds: readonly TaskId[];
  defaultDurationMinutes: WakeDurationMinutes;
  onboardingCompleted: boolean;
  revision: number;
}

export interface WakePersonalizationSnapshot {
  profileRevision: number;
  movementLevel: MovementLevel;
  availableResources: readonly WakeResource[];
  excludedTaskIds: readonly TaskId[];
  fallbackReason: "none" | "profile_missing" | "limited_eligible_tasks";
}

export interface WakeRoutineItem {
  id: string;
  title: string;
}

export interface WakeRoutine {
  enabled: boolean;
  items: readonly WakeRoutineItem[];
  revision: number;
}

export interface WakeRoutineRun {
  sessionId: string;
  items: readonly WakeRoutineItem[];
  completedItemIds: readonly string[];
  revision: number;
  completedAt: string | null;
}

export interface ProtocolStep {
  index: number;
  taskId: TaskId;
  category: TaskCategory;
}

export interface SessionTaskSubstitution {
  id: string;
  stepIndex: number;
  originalTaskId: TaskId;
  replacementTaskId: TaskId;
  reason: TaskSubstitutionReason;
  operationId: string;
  createdAt: string;
}

export interface WakeExperienceSnapshot {
  soundMode: WakeSoundMode;
}

export interface RecoveryBaselineProvenance {
  sessionId: string;
  ratingKind: "post_protocol";
}

export interface RecoveryOfferState {
  status: "eligible" | "declined" | "accepted";
  maxDurationSeconds: 90;
  recoverySessionId: string | null;
}

export interface ExperimentAssignment {
  id: string;
  protocolKey: string;
  protocolVersion: number;
  strategyVersion: string;
  phase: ExperimentPhase;
  hypothesis: string;
  steps: readonly ProtocolStep[];
  comparison?: {
    groupKey: string;
    factorKey: string;
    level: "with" | "without";
  };
}

export interface TaskObservation {
  stepIndex: number;
  taskId: TaskId;
  category: TaskCategory;
  correct: number;
  total: number;
  durationMs: number;
  difficultyLevel?: number;
  observedAt: string;
}

export interface WakeSession {
  id: string;
  userId: string;
  assignment: ExperimentAssignment;
  /** Отдельный effective-порядок позволяет читать старые ответы, где поля ещё не было. */
  effectiveSteps?: readonly ProtocolStep[];
  substitutions?: readonly SessionTaskSubstitution[];
  sessionKind?: SessionKind;
  parentSessionId?: string | null;
  recoveryBaseline?: RecoveryBaselineProvenance | null;
  recoveryOffer?: RecoveryOfferState | null;
  experience?: WakeExperienceSnapshot;
  wakeContext: WakeContext;
  durationMinutes: WakeDurationMinutes;
  personalization: WakePersonalizationSnapshot;
  status: SessionStatus;
  currentStepIndex: number;
  version: number;
  baseline: number | null;
  tasks: readonly TaskObservation[];
  postRating: number | null;
  followUp: FollowUpOutcome | null;
  startedAt: string | null;
  protocolCompletedAt: string | null;
  followUpDueAt: string | null;
  abandonedAt: string | null;
}

export interface CompletedSessionEvidence {
  sessionId: string;
  protocolKey: string;
  protocolVersion: number;
  baseline: number;
  postRating: number;
  followUp: FollowUpOutcome | null;
  /** Точный порядок фактически выполненных заданий; не содержит пользовательских данных. */
  sequenceKey?: string;
  /** Контекст и бюджет образуют границу сопоставимости порядка заданий. */
  wakeContext?: WakeContext;
  durationMinutes?: WakeDurationMinutes;
  completedAt?: string;
  comparison?: ExperimentAssignment["comparison"];
}

export interface AdaptiveProtocolEvidence {
  sequenceKey: string;
  wakeContext: WakeContext;
  durationMinutes: WakeDurationMinutes;
  baseline: number;
  postRating: number;
  followUp: FollowUpOutcome | null;
  completedAt?: string;
}

export interface Metric {
  key: string;
  value: number | null;
  evidenceCount: number;
  evidenceIds: readonly string[];
  confidence: Confidence;
}

export interface AnalyticsProfile {
  methodVersion: "analytics-v1" | "analytics-v2";
  computedAt: string;
  averageDelta: Metric;
  riseSuccess: Metric;
  protocolEffects: readonly Metric[];
  factorEffects: readonly Metric[];
  comparisonProgress?: readonly FactorComparisonProgress[];
  sequenceEffects: readonly Metric[];
  dailyTrend?: readonly DailyWakeTrendPoint[];
}

export interface FactorComparisonProgress {
  key: string;
  factorKey: string;
  groupKey: string;
  withCount: number;
  withoutCount: number;
  pairCount: number;
  targetPairs: 3;
  status: "collecting" | "ready";
}

export interface DailyWakeTrendPoint {
  localDate: string;
  averageDelta: number;
  evidenceCount: number;
  sessionIds: readonly string[];
}

export type SessionCommandErrorCode =
  | "invalid_transition"
  | "stale_version"
  | "invalid_rating"
  | "invalid_task_result"
  | "unexpected_step"
  | "follow_up_already_recorded";

export class SessionCommandError extends Error {
  constructor(
    readonly code: SessionCommandErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionCommandError";
  }
}
