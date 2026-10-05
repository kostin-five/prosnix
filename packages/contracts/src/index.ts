import { type Static, Type } from "@sinclair/typebox";

export const TASK_IDS = [
  "math",
  "memory",
  "stroop",
  "reaction",
  "steps",
  "squats",
  "shake",
  "water",
  "window",
  "curtains",
  "sit_edge",
  "cool_wash",
  "pushups",
  "notice_three",
  "find_color",
  "breathing",
] as const;

export const TASK_CATEGORIES = ["cognitive", "movement", "behavioral", "environment"] as const;

export const FOLLOW_UP_OUTCOMES = ["up", "back", "drowsy"] as const;
export const SESSION_KINDS = ["primary", "recovery"] as const;
export const TASK_SUBSTITUTION_REASONS = ["unwilling_now", "not_helpful", "cannot_do"] as const;
export const WAKE_SOUND_MODES = ["unknown", "off", "on"] as const;
export const WAKE_INTERACTION_MODES = ["manual", "hands_free"] as const;

export const TaskIdSchema = Type.Union(TASK_IDS.map((value) => Type.Literal(value)));
export const TaskCategorySchema = Type.Union(TASK_CATEGORIES.map((value) => Type.Literal(value)));
export const FollowUpOutcomeSchema = Type.Union(
  FOLLOW_UP_OUTCOMES.map((value) => Type.Literal(value)),
);
export const SessionKindSchema = Type.Union(SESSION_KINDS.map((value) => Type.Literal(value)));
export const TaskSubstitutionReasonSchema = Type.Union(
  TASK_SUBSTITUTION_REASONS.map((value) => Type.Literal(value)),
);
export const WakeSoundModeSchema = Type.Union(WAKE_SOUND_MODES.map((value) => Type.Literal(value)));
export const WakeInteractionModeSchema = Type.Union(
  WAKE_INTERACTION_MODES.map((value) => Type.Literal(value)),
);
export const WakeExperienceSnapshotSchema = Type.Object(
  {
    soundMode: WakeSoundModeSchema,
    interactionMode: Type.Optional(WakeInteractionModeSchema),
  },
  { additionalProperties: false },
);

export const RatingInputSchema = Type.Object(
  {
    value: Type.Integer({ minimum: 1, maximum: 10 }),
    clientObservedAt: Type.Optional(Type.String({ format: "date-time" })),
    experience: Type.Optional(WakeExperienceSnapshotSchema),
  },
  { additionalProperties: false },
);

export const PostRatingInputSchema = Type.Object(
  {
    value: Type.Integer({ minimum: 1, maximum: 10 }),
    clientObservedAt: Type.Optional(Type.String({ format: "date-time" })),
    completionReason: Type.Optional(Type.Literal("awakened")),
  },
  { additionalProperties: false },
);
export type PostRatingInput = Static<typeof PostRatingInputSchema>;

export const TaskResultInputSchema = Type.Object(
  {
    taskId: TaskIdSchema,
    correct: Type.Integer({ minimum: 0 }),
    total: Type.Integer({ minimum: 0 }),
    durationMs: Type.Integer({ minimum: 0, maximum: 60 * 60 * 1000 }),
    completionSource: Type.Optional(Type.Union([Type.Literal("manual"), Type.Literal("timer")])),
    difficultyLevel: Type.Optional(Type.Integer({ minimum: 1, maximum: 3 })),
  },
  { additionalProperties: false },
);

export const TaskSubstitutionInputSchema = Type.Object(
  { reason: TaskSubstitutionReasonSchema },
  { additionalProperties: false },
);

export const FollowUpInputSchema = Type.Object(
  { outcome: FollowUpOutcomeSchema },
  { additionalProperties: false },
);

export type TaskId = Static<typeof TaskIdSchema>;
export type TaskCategory = Static<typeof TaskCategorySchema>;
export type FollowUpOutcome = Static<typeof FollowUpOutcomeSchema>;
export type SessionKind = Static<typeof SessionKindSchema>;
export type TaskSubstitutionReason = Static<typeof TaskSubstitutionReasonSchema>;
export type WakeSoundMode = Static<typeof WakeSoundModeSchema>;
export type WakeInteractionMode = Static<typeof WakeInteractionModeSchema>;
export type WakeExperienceSnapshot = Static<typeof WakeExperienceSnapshotSchema>;
export type RatingInput = Static<typeof RatingInputSchema>;
export type TaskResultInput = Static<typeof TaskResultInputSchema>;
export type TaskSubstitutionInput = Static<typeof TaskSubstitutionInputSchema>;
export type FollowUpInput = Static<typeof FollowUpInputSchema>;

export const ExperimentFeedbackInputSchema = Type.Object(
  {
    helpful: Type.Integer({ minimum: 1, maximum: 5 }),
    irritating: Type.Integer({ minimum: 1, maximum: 5 }),
    continueIntent: Type.Integer({ minimum: 1, maximum: 5 }),
  },
  { additionalProperties: false },
);
export type ExperimentFeedbackInput = Static<typeof ExperimentFeedbackInputSchema>;

export const PRO_INTEREST_INTENTS = ["interested", "not_now", "not_interested"] as const;
export const PRO_INTEREST_FOCUSES = ["long_history", "deeper_experiments", "both"] as const;

export const ProInterestInputSchema = Type.Object(
  {
    intent: Type.Union(PRO_INTEREST_INTENTS.map((value) => Type.Literal(value))),
    interestFocus: Type.Optional(
      Type.Union(PRO_INTEREST_FOCUSES.map((value) => Type.Literal(value))),
    ),
  },
  { additionalProperties: false },
);
export type ProInterestInput = Static<typeof ProInterestInputSchema>;

export const WAKE_CONTEXTS = ["night_sleep", "short_nap", "long_nap", "energy_reset"] as const;
export const WAKE_DURATIONS = [2, 5, 10] as const;
export const MOVEMENT_LEVELS = ["none", "light", "full"] as const;
export const WAKE_RESOURCES = [
  "water",
  "bright_light",
  "floor_space",
  "wash_access",
  "active_movement",
] as const;

export const WakeContextSchema = Type.Union(WAKE_CONTEXTS.map((value) => Type.Literal(value)));
export const WakeDurationSchema = Type.Union(WAKE_DURATIONS.map((value) => Type.Literal(value)));
export const MovementLevelSchema = Type.Union(MOVEMENT_LEVELS.map((value) => Type.Literal(value)));
export const WakeResourceSchema = Type.Union(WAKE_RESOURCES.map((value) => Type.Literal(value)));

export const CreateWakeSessionInputSchema = Type.Object(
  {
    timezone: Type.String({ minLength: 1, maxLength: 100 }),
    wakeContext: WakeContextSchema,
    durationMinutes: WakeDurationSchema,
    interactionMode: Type.Optional(WakeInteractionModeSchema),
  },
  { additionalProperties: false },
);

export const WakeProfileInputSchema = Type.Object(
  {
    movementLevel: MovementLevelSchema,
    availableResources: Type.Array(WakeResourceSchema, { maxItems: 5, uniqueItems: true }),
    excludedTaskIds: Type.Array(TaskIdSchema, { maxItems: 16, uniqueItems: true }),
    defaultDurationMinutes: WakeDurationSchema,
    onboardingCompleted: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const LifeGoalInputSchema = Type.Object(
  { text: Type.String({ maxLength: 120 }) },
  { additionalProperties: false },
);
export type LifeGoalInput = Static<typeof LifeGoalInputSchema>;

export const WakeRoutineItemSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 64 }),
    title: Type.String({ minLength: 1, maxLength: 80 }),
  },
  { additionalProperties: false },
);
export const WakeRoutineInputSchema = Type.Object(
  { enabled: Type.Boolean(), items: Type.Array(WakeRoutineItemSchema, { maxItems: 5 }) },
  { additionalProperties: false },
);
export const WakeRoutineProgressInputSchema = Type.Object(
  {
    completedItemIds: Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
      maxItems: 5,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

export type WakeContext = Static<typeof WakeContextSchema>;
export type WakeDurationMinutes = Static<typeof WakeDurationSchema>;
export type CreateWakeSessionInput = Static<typeof CreateWakeSessionInputSchema>;
export type WakeProfileInput = Static<typeof WakeProfileInputSchema>;
export type WakeRoutineInput = Static<typeof WakeRoutineInputSchema>;
export type WakeRoutineProgressInput = Static<typeof WakeRoutineProgressInputSchema>;

export const BOT_STATUSES = ["unknown", "available", "blocked"] as const;
export const BotStatusSchema = Type.Union(BOT_STATUSES.map((value) => Type.Literal(value)));

export const WakeScheduleInputSchema = Type.Object(
  {
    localTime: Type.String({ pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" }),
    timezone: Type.String({ minLength: 1, maxLength: 100 }),
    enabled: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const WakeScheduleSchema = Type.Object(
  {
    localTime: Type.String(),
    timezone: Type.String(),
    enabled: Type.Boolean(),
    nextTriggerAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    botStatus: BotStatusSchema,
    revision: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export type BotStatus = Static<typeof BotStatusSchema>;
export type WakeScheduleInput = Static<typeof WakeScheduleInputSchema>;
export type WakeScheduleResponse = Static<typeof WakeScheduleSchema>;

export const CoachInsightRequestSchema = Type.Object(
  { confirmEarly: Type.Optional(Type.Boolean()) },
  { additionalProperties: false },
);

export type CoachInsightRequest = Static<typeof CoachInsightRequestSchema>;

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
  completedEarly?: boolean;
  id: string;
  completedAt: string;
  baseline: number;
  postRating: number;
  durationMs: number | null;
  followUp: "up" | "back" | "drowsy" | null;
  tasks: Array<{
    taskId: TaskId;
    category: TaskCategory;
  }>;
  wakeContext: "unspecified" | WakeContext;
  durationMinutes: WakeDurationMinutes;
  sessionKind: SessionKind;
  parentSessionId: string | null;
}

export interface SessionTaskSubstitutionResponse {
  id: string;
  stepIndex: number;
  originalTaskId: TaskId;
  replacementTaskId: TaskId;
  reason: TaskSubstitutionReason;
  operationId: string;
  createdAt: string;
}

/** Поля добавляются к session payload обратно совместимо: старый клиент продолжает читать assignment. */
export interface WakeSessionEvolutionResponse {
  effectiveSteps?: Array<{
    index: number;
    taskId: TaskId;
    category: TaskCategory;
  }>;
  substitutions?: SessionTaskSubstitutionResponse[];
  sessionKind?: SessionKind;
  parentSessionId?: string | null;
  recoveryBaseline?: { sessionId: string; ratingKind: "post_protocol" } | null;
  recoveryOffer?: {
    status: "eligible" | "declined" | "accepted";
    maxDurationSeconds: 90;
    recoverySessionId: string | null;
  } | null;
  experience?: WakeExperienceSnapshot & { completedEarly?: boolean };
}

export interface SessionHistoryResponse {
  sessions: SessionHistoryItemResponse[];
}

export const LegalAcceptanceInputSchema = Type.Object(
  {
    privacyVersion: Type.String({ minLength: 1, maxLength: 40 }),
    termsVersion: Type.String({ minLength: 1, maxLength: 40 }),
  },
  { additionalProperties: false },
);

export type LegalAcceptanceInput = Static<typeof LegalAcceptanceInputSchema>;

export interface LegalStatusResponse {
  privacyVersion: string;
  termsVersion: string;
  accepted: boolean;
  acceptedAt: string | null;
}

export type GrowthPeriodDays = 7 | 30 | 90;

export interface AdminGrowthResponse {
  period: { days: GrowthPeriodDays; from: string; to: string };
  computedAt: string;
  users: { total: number; new: number; active: number };
  sessions: { started: number; completed: number; abandoned: number; completionRate: number };
  funnel: {
    assigned: number;
    started: number;
    baselineRecorded: number;
    completed: number;
    followedUp: number;
    droppedBeforeBaseline: number;
    droppedAfterBaseline: number;
    startRate: number;
    baselineRate: number;
    completionRate: number;
    followUpRate: number;
  };
  wakeQuality: {
    pairedSessions: number;
    averageDelta: number | null;
    improvedSessions: number;
    improvedRate: number;
  };
  followUp: {
    eligible: number;
    answered: number;
    responseRate: number;
    up: number;
    back: number;
    drowsy: number;
    stayedUpRate: number;
  };
  retention: {
    d1: { eligible: number; retained: number; rate: number };
    d3: { eligible: number; retained: number; rate: number };
    d7: { eligible: number; retained: number; rate: number };
    secondSessionWithin7Days: {
      cohort: number;
      eligible: number;
      returned: number;
      pending: number;
      rate: number;
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
      key: "unspecified" | (typeof WAKE_CONTEXTS)[number];
      sessions: number;
      completed: number;
      completionRate: number;
    }>;
    durations: Array<{
      minutes: (typeof WAKE_DURATIONS)[number];
      sessions: number;
      completed: number;
      completionRate: number;
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
  deliveries: {
    dailySent: number;
    followUpSent: number;
    failed: number;
    blocked: number;
    terminal: number;
    successRate: number;
  };
  billing: { enabled: boolean; activeSubscriptions: number; grossStars: number };
}

export interface BillingStatusResponse {
  enabled: boolean;
  plan: { key: "pro-monthly-v1"; priceStars: number | null; periodDays: 30 };
  entitlement: {
    status: "free" | "active" | "canceled" | "past_due" | "expired" | "refunded";
    currentPeriodEnd: string | null;
  };
}

export interface BillingCheckoutResponse {
  invoiceUrl: string;
  expiresAt: string;
}
