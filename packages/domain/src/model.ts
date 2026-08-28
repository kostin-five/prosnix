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
  | "curtains";

export type TaskCategory = "cognitive" | "movement" | "behavioral" | "environment";
export type FollowUpOutcome = "up" | "back" | "drowsy";
export type SessionStatus = "assigned" | "in_progress" | "protocol_completed" | "abandoned";
export type ExperimentPhase = "learning" | "adaptive" | "fallback";
export type Confidence = "insufficient" | "low" | "medium" | "high";

export interface ProtocolStep {
  index: number;
  taskId: TaskId;
  category: TaskCategory;
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
  observedAt: string;
}

export interface WakeSession {
  id: string;
  userId: string;
  assignment: ExperimentAssignment;
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
  comparison?: ExperimentAssignment["comparison"];
}

export interface Metric {
  key: string;
  value: number | null;
  evidenceCount: number;
  evidenceIds: readonly string[];
  confidence: Confidence;
}

export interface AnalyticsProfile {
  methodVersion: "analytics-v1";
  computedAt: string;
  averageDelta: Metric;
  riseSuccess: Metric;
  protocolEffects: readonly Metric[];
  factorEffects: readonly Metric[];
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
