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
] as const;

export const TASK_CATEGORIES = ["cognitive", "movement", "behavioral", "environment"] as const;

export const FOLLOW_UP_OUTCOMES = ["up", "back", "drowsy"] as const;

export const TaskIdSchema = Type.Union(TASK_IDS.map((value) => Type.Literal(value)));
export const TaskCategorySchema = Type.Union(TASK_CATEGORIES.map((value) => Type.Literal(value)));
export const FollowUpOutcomeSchema = Type.Union(
  FOLLOW_UP_OUTCOMES.map((value) => Type.Literal(value)),
);

export const RatingInputSchema = Type.Object(
  {
    value: Type.Integer({ minimum: 1, maximum: 10 }),
    clientObservedAt: Type.Optional(Type.String({ format: "date-time" })),
  },
  { additionalProperties: false },
);

export const TaskResultInputSchema = Type.Object(
  {
    taskId: TaskIdSchema,
    correct: Type.Integer({ minimum: 0 }),
    total: Type.Integer({ minimum: 0 }),
    durationMs: Type.Integer({ minimum: 0, maximum: 60 * 60 * 1000 }),
  },
  { additionalProperties: false },
);

export const FollowUpInputSchema = Type.Object(
  { outcome: FollowUpOutcomeSchema },
  { additionalProperties: false },
);

export type TaskId = Static<typeof TaskIdSchema>;
export type TaskCategory = Static<typeof TaskCategorySchema>;
export type FollowUpOutcome = Static<typeof FollowUpOutcomeSchema>;
export type RatingInput = Static<typeof RatingInputSchema>;
export type TaskResultInput = Static<typeof TaskResultInputSchema>;
export type FollowUpInput = Static<typeof FollowUpInputSchema>;

export const WAKE_CONTEXTS = ["night_sleep", "short_nap", "long_nap", "energy_reset"] as const;
export const WAKE_DURATIONS = [2, 5, 10] as const;
export const MOVEMENT_LEVELS = ["none", "light", "full"] as const;
export const WAKE_RESOURCES = ["water", "bright_light", "floor_space"] as const;

export const WakeContextSchema = Type.Union(WAKE_CONTEXTS.map((value) => Type.Literal(value)));
export const WakeDurationSchema = Type.Union(WAKE_DURATIONS.map((value) => Type.Literal(value)));
export const MovementLevelSchema = Type.Union(MOVEMENT_LEVELS.map((value) => Type.Literal(value)));
export const WakeResourceSchema = Type.Union(WAKE_RESOURCES.map((value) => Type.Literal(value)));

export const CreateWakeSessionInputSchema = Type.Object(
  {
    timezone: Type.String({ minLength: 1, maxLength: 100 }),
    wakeContext: WakeContextSchema,
    durationMinutes: WakeDurationSchema,
  },
  { additionalProperties: false },
);

export const WakeProfileInputSchema = Type.Object(
  {
    movementLevel: MovementLevelSchema,
    availableResources: Type.Array(WakeResourceSchema, { maxItems: 3, uniqueItems: true }),
    excludedTaskIds: Type.Array(TaskIdSchema, { maxItems: 10, uniqueItems: true }),
    defaultDurationMinutes: WakeDurationSchema,
    onboardingCompleted: Type.Boolean(),
  },
  { additionalProperties: false },
);

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

export interface CoachInsightResponse {
  status: "ready" | "insufficient" | "unavailable";
  evidenceCount: number;
  cached: boolean;
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
  durationMs: number | null;
  followUp: "up" | "back" | "drowsy" | null;
  tasks: Array<{
    taskId: TaskId;
    category: TaskCategory;
  }>;
  wakeContext: "unspecified" | WakeContext;
  durationMinutes: WakeDurationMinutes;
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
    completed: number;
    followedUp: number;
    startRate: number;
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
    d7: { eligible: number; retained: number; rate: number };
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
