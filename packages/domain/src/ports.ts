import type {
  AnalyticsProfile,
  FollowUpOutcome,
  SessionStatus,
  TaskId,
  TaskSubstitutionReason,
  WakeSession,
  WakeCapabilityProfile,
  WakeContext,
  WakeDurationMinutes,
  WakeRoutine,
  WakeRoutineRun,
} from "./model.js";
import type { WakeScheduleValue } from "./schedule/schedule.js";

export interface UserRecord {
  id: string;
  telegramUserId: bigint;
  locale: string | null;
  timezone: string;
  deletionRequestedAt: Date | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  assignmentId: string;
  status: SessionStatus;
  currentStepIndex: number;
  version: number;
  wakeContext: WakeContext;
  durationMinutes: WakeDurationMinutes;
  personalization: import("./model.js").WakePersonalizationSnapshot;
  sessionKind?: import("./model.js").SessionKind;
  parentSessionId?: string | null;
  recoveryBaseline?: import("./model.js").RecoveryBaselineProvenance | null;
  experience?: import("./model.js").WakeExperienceSnapshot;
  startedAt: Date | null;
  protocolCompletedAt: Date | null;
  followUpDueAt: Date | null;
  abandonedAt: Date | null;
}

export interface StoredCommandResult {
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
}

export interface UserRepository {
  findByTelegramId(telegramUserId: bigint): Promise<UserRecord | null>;
  createFromTelegram(input: { telegramUserId: bigint; locale?: string }): Promise<UserRecord>;
}

export interface SessionRepository {
  findActiveForUser(userId: string): Promise<SessionRecord | null>;
  findOwnedById(userId: string, sessionId: string): Promise<SessionRecord | null>;
  updateState(input: {
    userId: string;
    sessionId: string;
    expectedVersion: number;
    status: SessionStatus;
    currentStepIndex: number;
    startedAt?: Date | null;
    protocolCompletedAt?: Date | null;
    followUpDueAt?: Date | null;
    abandonedAt?: Date | null;
  }): Promise<SessionRecord | null>;
}

export interface IdempotencyRepository {
  find(userId: string, operationId: string): Promise<StoredCommandResult | null>;
  save(input: {
    userId: string;
    operationId: string;
    commandType: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
    expiresAt: Date;
  }): Promise<void>;
}

export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  idempotency: IdempotencyRepository;
}

export interface BootstrapSession {
  session: SessionRecord;
  protocol: {
    key: string;
    version: number;
    title: string;
    steps: unknown;
    effectiveSteps?: unknown;
  };
  assignment: {
    strategyVersion: string;
    phase: "learning" | "adaptive" | "fallback";
    hypothesis: string;
  };
  baseline: number | null;
  postRating: number | null;
  substitutions?: SessionTaskSubstitutionRecord[];
}

export interface BootstrapSnapshot {
  user: UserRecord;
  activeSession: BootstrapSession | null;
  dueFollowUpSessionId: string | null;
  wakeSchedule: WakeScheduleValue | null;
  wakeProfile: WakeCapabilityProfile;
  wakeRoutine: WakeRoutine;
}

export interface BootstrapRepository {
  load(userId: string, now?: Date): Promise<BootstrapSnapshot | null>;
}

export interface UnitOfWork {
  transaction<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

export type SessionCommand =
  | {
      type: "create";
      timezone: string;
      wakeContext: Exclude<WakeContext, "unspecified">;
      durationMinutes: WakeDurationMinutes;
    }
  | {
      type: "baseline";
      sessionId: string;
      expectedVersion: number;
      value: number;
      clientObservedAt?: string;
      experience?: import("./model.js").WakeExperienceSnapshot;
    }
  | {
      type: "task";
      sessionId: string;
      expectedVersion: number;
      stepIndex: number;
      taskId: TaskId;
      correct: number;
      total: number;
      durationMs: number;
      difficultyLevel?: number;
    }
  | {
      type: "substitute";
      sessionId: string;
      expectedVersion: number;
      stepIndex: number;
      reason: TaskSubstitutionReason;
    }
  | {
      type: "post_rating";
      sessionId: string;
      expectedVersion: number;
      value: number;
      clientObservedAt?: string;
    }
  | {
      type: "start_recovery";
      sessionId: string;
      expectedVersion: number;
    }
  | {
      type: "decline_recovery";
      sessionId: string;
      expectedVersion: number;
    }
  | {
      type: "follow_up";
      sessionId: string;
      expectedVersion?: number;
      outcome: FollowUpOutcome;
    }
  | {
      type: "abandon";
      sessionId: string;
      expectedVersion: number;
    };

export interface SessionCommandEnvelope {
  userId: string;
  operationId: string;
  requestHash: string;
  observedAt: Date;
  command: SessionCommand;
}

export interface SessionCommandResult {
  session: WakeSession;
  responseStatus: 200 | 201;
  replayed: boolean;
}

export class SessionCommandConflict extends Error {
  constructor(
    readonly code:
      | "idempotency_conflict"
      | "stale_version"
      | "invalid_transition"
      | "session_not_found"
      | "no_alternative"
      | "recovery_unavailable",
    message: string,
    readonly canonicalSession: WakeSession | null,
  ) {
    super(message);
    this.name = "SessionCommandConflict";
  }
}

export interface SessionCommandRepository {
  execute(envelope: SessionCommandEnvelope): Promise<SessionCommandResult>;
}

export interface SessionTaskSubstitutionRecord {
  id: string;
  sessionId: string;
  stepIndex: number;
  originalTaskId: TaskId;
  replacementTaskId: TaskId;
  reason: TaskSubstitutionReason;
  operationId: string;
  createdAt: Date;
}

export interface SessionTaskSubstitutionRepository {
  list(userId: string, sessionId: string): Promise<SessionTaskSubstitutionRecord[]>;
  append(input: {
    userId: string;
    sessionId: string;
    stepIndex: number;
    originalTaskId: TaskId;
    replacementTaskId: TaskId;
    reason: TaskSubstitutionReason;
    operationId: string;
    requestHash: string;
    now: Date;
  }): Promise<SessionTaskSubstitutionRecord>;
}

export class SessionTaskSubstitutionConflict extends Error {
  constructor(
    readonly code: "session_not_found" | "idempotency_conflict",
    message: string,
  ) {
    super(message);
    this.name = "SessionTaskSubstitutionConflict";
  }
}

export interface AnalyticsRepository {
  recompute(userId: string, now?: Date): Promise<AnalyticsProfile>;
}

export interface ExperimentFeedbackStatus {
  eligible: boolean;
  submitted: boolean;
}

export interface ExperimentFeedbackRepository {
  status(userId: string): Promise<ExperimentFeedbackStatus>;
  submit(input: {
    userId: string;
    helpful: number;
    irritating: number;
    continueIntent: number;
    now: Date;
  }): Promise<ExperimentFeedbackStatus>;
}

export type ProInterestIntent = "interested" | "not_now" | "not_interested";
export type ProInterestFocus = "long_history" | "deeper_experiments" | "both";

export interface ProInterestStatus {
  eligible: boolean;
  submitted: boolean;
}

export interface ProInterestRepository {
  status(userId: string): Promise<ProInterestStatus>;
  submit(input: {
    userId: string;
    intent: ProInterestIntent;
    interestFocus?: ProInterestFocus;
    now: Date;
  }): Promise<ProInterestStatus>;
}

export interface UserDeletionRepository {
  deleteUser(userId: string, correlationId: string, now?: Date): Promise<boolean>;
}

export interface CoachInsightRecord {
  userId: string;
  evidenceFingerprint: string;
  summary: string;
  nextExperiment: string;
  caveat: string;
  model: string;
  evidenceCount: number;
  generatedAt: Date;
}

export interface CoachInsightRepository {
  findByUserId(userId: string): Promise<CoachInsightRecord | null>;
  findTimezoneByUserId?(userId: string): Promise<string>;
  save(record: CoachInsightRecord, now?: Date): Promise<CoachInsightRecord>;
}

export interface SessionHistoryItem {
  id: string;
  completedAt: Date;
  baseline: number;
  postRating: number;
  durationMs: number | null;
  followUp: FollowUpOutcome | null;
  tasks: Array<{ taskId: TaskId; category: import("./model.js").TaskCategory }>;
  wakeContext: WakeContext;
  durationMinutes: WakeDurationMinutes;
  sessionKind: import("./model.js").SessionKind;
  parentSessionId: string | null;
}

export interface SessionHistoryRepository {
  listCompleted(userId: string, limit: number): Promise<SessionHistoryItem[]>;
}

export interface LegalAcceptanceRecord {
  privacyVersion: string;
  termsVersion: string;
  acceptedAt: Date;
}

export interface LegalAcceptanceRepository {
  find(userId: string): Promise<LegalAcceptanceRecord | null>;
  accept(input: {
    userId: string;
    privacyVersion: string;
    termsVersion: string;
    acceptedAt: Date;
  }): Promise<void>;
}

export interface AdminGrowthSummary {
  users: { total: number; new: number; active: number };
  sessions: { started: number; completed: number; abandoned: number };
  funnel: {
    assigned: number;
    started: number;
    baselineRecorded: number;
    completed: number;
    followedUp: number;
    droppedBeforeBaseline: number;
    droppedAfterBaseline: number;
  };
  wakeQuality: {
    pairedSessions: number;
    averageDelta: number | null;
    improvedSessions: number;
  };
  followUp: {
    eligible: number;
    answered: number;
    up: number;
    back: number;
    drowsy: number;
  };
  retention: {
    d1Eligible: number;
    d1Retained: number;
    d3Eligible: number;
    d3Retained: number;
    d7Eligible: number;
    d7Retained: number;
    secondSessionWithin7Days: {
      cohort: number;
      eligible: number;
      returned: number;
      pending: number;
    };
  };
  timeline: Array<{
    date: string;
    newUsers: number;
    startedSessions: number;
    completedSessions: number;
  }>;
  breakdowns: {
    contexts: Array<{
      key: WakeContext | "unspecified";
      sessions: number;
      completed: number;
    }>;
    durations: Array<{
      minutes: WakeDurationMinutes;
      sessions: number;
      completed: number;
    }>;
    experiments: Array<{
      version: string;
      assigned: number;
      completed: number;
    }>;
    proInterest: {
      responses: number;
      interested: number;
      notNow: number;
      notInterested: number;
      longHistory: number;
      deeperExperiments: number;
      both: number;
    };
  };
  features: {
    capabilityProfiles: number;
    routinesEnabled: number;
    routineRuns: number;
    routineRunsCompleted: number;
    aiInsightsGenerated: number;
  };
  deliveries: { dailySent: number; followUpSent: number; failed: number; blocked: number };
  billing: { activeSubscriptions: number; grossStars: number };
}

export interface AdminGrowthRepository {
  isAllowed(userId: string, telegramUserIds: readonly bigint[]): Promise<boolean>;
  summarize(from: Date, now: Date): Promise<AdminGrowthSummary>;
}

export type SubscriptionState = "active" | "canceled" | "past_due" | "expired" | "refunded";

export interface BillingCheckoutRecord {
  id: string;
  userId: string;
  planKey: string;
  priceStars: number;
  status: "pending" | "paid" | "expired" | "canceled";
  invoiceUrl: string | null;
  expiresAt: Date;
}

export interface SubscriptionRecord {
  status: SubscriptionState;
  currentPeriodEnd: Date;
}

export interface BillingRepository {
  findSubscription(userId: string): Promise<SubscriptionRecord | null>;
  createCheckout(input: {
    userId: string;
    planKey: string;
    priceStars: number;
    expiresAt: Date;
  }): Promise<BillingCheckoutRecord>;
  setInvoiceUrl(checkoutId: string, invoiceUrl: string): Promise<void>;
  findCheckout(checkoutId: string): Promise<BillingCheckoutRecord | null>;
  checkoutBelongsToTelegramUser(checkoutId: string, telegramUserId: bigint): Promise<boolean>;
  activate(input: {
    updateId: bigint;
    checkoutId: string;
    telegramUserId: bigint;
    currency: string;
    totalAmount: number;
    telegramPaymentChargeId: string;
    currentPeriodEnd: Date;
    paidAt: Date;
    isRecurring: boolean;
    isFirstRecurring: boolean;
  }): Promise<"activated" | "duplicate" | "rejected">;
  updateSubscriptionState(input: {
    updateId: bigint;
    checkoutId: string;
    telegramUserId: bigint;
    state: "active" | "canceled" | "past_due";
    observedAt: Date;
  }): Promise<"updated" | "duplicate" | "rejected">;
}

export interface WakePersonalizationRepository {
  loadProfile(userId: string): Promise<WakeCapabilityProfile>;
  saveProfile(input: {
    userId: string;
    expectedRevision: number;
    operationId: string;
    profile: Omit<WakeCapabilityProfile, "revision">;
    now: Date;
  }): Promise<WakeCapabilityProfile>;
  loadRoutine(userId: string): Promise<WakeRoutine>;
  loadRoutineRun(userId: string, sessionId: string): Promise<WakeRoutineRun | null>;
  saveRoutine(input: {
    userId: string;
    expectedRevision: number;
    operationId: string;
    routine: Omit<WakeRoutine, "revision">;
    now: Date;
  }): Promise<WakeRoutine>;
  saveRoutineRun(input: {
    userId: string;
    sessionId: string;
    expectedRevision: number;
    operationId: string;
    completedItemIds: readonly string[];
    now: Date;
  }): Promise<WakeRoutineRun>;
}

export class PersonalizationConflict extends Error {
  constructor(
    readonly code: "stale_version" | "idempotency_conflict" | "session_not_found" | "invalid_state",
    message: string,
  ) {
    super(message);
    this.name = "PersonalizationConflict";
  }
}
