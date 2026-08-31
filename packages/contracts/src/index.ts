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
}

export interface SessionHistoryResponse {
  sessions: SessionHistoryItemResponse[];
}
