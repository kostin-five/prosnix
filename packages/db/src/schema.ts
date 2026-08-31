import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const sessionStatus = pgEnum("session_status", [
  "assigned",
  "in_progress",
  "protocol_completed",
  "abandoned",
]);
export const experimentPhase = pgEnum("experiment_phase", ["learning", "adaptive", "fallback"]);
export const taskCategory = pgEnum("task_category", [
  "cognitive",
  "movement",
  "behavioral",
  "environment",
]);
export const ratingKind = pgEnum("rating_kind", ["baseline", "post_protocol"]);
export const followUpOutcome = pgEnum("follow_up_outcome", ["up", "back", "drowsy"]);
export const confidence = pgEnum("confidence", ["insufficient", "low", "medium", "high"]);
export const botStatus = pgEnum("bot_status", ["unknown", "available", "blocked"]);
export const notificationDeliveryStatus = pgEnum("notification_delivery_status", [
  "sending",
  "retry_wait",
  "sent",
  "blocked",
  "ambiguous",
  "failed",
  "skipped",
]);
export const billingCheckoutStatus = pgEnum("billing_checkout_status", [
  "pending",
  "paid",
  "expired",
  "canceled",
]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "expired",
  "refunded",
]);

export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey(),
    telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
    locale: text(),
    timezone: text().notNull().default("UTC"),
    learningSessionCount: integer("learning_session_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  },
  (table) => [
    unique("users_telegram_user_id_unique").on(table.telegramUserId),
    check("users_learning_count_nonnegative", sql`${table.learningSessionCount} >= 0`),
  ],
);

export const wakeSchedules = pgTable(
  "wake_schedules",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    localTime: text("local_time").notNull(),
    timezone: text().notNull(),
    enabled: boolean().notNull().default(false),
    nextTriggerAt: timestamp("next_trigger_at", { withTimezone: true }),
    botStatus: botStatus("bot_status").notNull().default("unknown"),
    revision: integer().notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("wake_schedules_due_idx").on(table.nextTriggerAt),
    check(
      "wake_schedules_time_format",
      sql`${table.localTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
    check("wake_schedules_revision_positive", sql`${table.revision} > 0`),
    check(
      "wake_schedules_enabled_trigger",
      sql`not ${table.enabled} or ${table.nextTriggerAt} is not null`,
    ),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid().defaultRandom().primaryKey(),
    scheduleUserId: uuid("schedule_user_id")
      .notNull()
      .references(() => wakeSchedules.userId, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: notificationDeliveryStatus().notNull(),
    attempts: integer().notNull().default(1),
    retryAt: timestamp("retry_at", { withTimezone: true }),
    telegramMessageId: bigint("telegram_message_id", { mode: "bigint" }),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    unique("notification_deliveries_schedule_time_unique").on(
      table.scheduleUserId,
      table.scheduledFor,
    ),
    index("notification_deliveries_retry_idx").on(table.status, table.retryAt),
    index("notification_deliveries_created_idx").on(table.createdAt),
    check("notification_deliveries_attempts_range", sql`${table.attempts} between 1 and 2`),
  ],
);

export const protocolDefinitions = pgTable(
  "protocol_definitions",
  {
    id: uuid().defaultRandom().primaryKey(),
    protocolKey: text("protocol_key").notNull(),
    version: integer().notNull(),
    title: text().notNull(),
    steps: jsonb().notNull(),
    activeFrom: timestamp("active_from", { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (table) => [
    unique("protocol_definitions_key_version_unique").on(table.protocolKey, table.version),
    check("protocol_definitions_version_positive", sql`${table.version} > 0`),
  ],
);

export const experimentAssignments = pgTable(
  "experiment_assignments",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    protocolDefinitionId: uuid("protocol_definition_id")
      .notNull()
      .references(() => protocolDefinitions.id),
    strategyVersion: text("strategy_version").notNull(),
    phase: experimentPhase().notNull(),
    hypothesis: text().notNull(),
    evaluatedFactor: text("evaluated_factor"),
    comparisonGroupKey: text("comparison_group_key"),
    comparisonLevel: text("comparison_level"),
    evidenceSnapshot: jsonb("evidence_snapshot").notNull().default({}),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("experiment_assignments_user_idx").on(table.userId)],
);

export const wakeSessions = pgTable(
  "wake_sessions",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => experimentAssignments.id),
    status: sessionStatus().notNull().default("assigned"),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    version: integer().notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }),
    protocolCompletedAt: timestamp("protocol_completed_at", { withTimezone: true }),
    followUpDueAt: timestamp("follow_up_due_at", { withTimezone: true }),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("wake_sessions_assignment_unique").on(table.assignmentId),
    check("wake_sessions_step_nonnegative", sql`${table.currentStepIndex} >= 0`),
    check("wake_sessions_version_positive", sql`${table.version} > 0`),
    uniqueIndex("wake_sessions_one_active_per_user")
      .on(table.userId)
      .where(sql`${table.status} in ('assigned', 'in_progress')`),
  ],
);

export const ratingObservations = pgTable(
  "rating_observations",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => wakeSessions.id, { onDelete: "cascade" }),
    kind: ratingKind().notNull(),
    value: integer().notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    clientObservedAt: timestamp("client_observed_at", { withTimezone: true }),
    operationId: text("operation_id").notNull(),
  },
  (table) => [
    unique("rating_observations_session_kind_unique").on(table.sessionId, table.kind),
    unique("rating_observations_user_operation_unique").on(table.userId, table.operationId),
    check("rating_observations_value_range", sql`${table.value} between 1 and 10`),
  ],
);

export const taskObservations = pgTable(
  "task_observations",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => wakeSessions.id, { onDelete: "cascade" }),
    protocolStepIndex: integer("protocol_step_index").notNull(),
    taskId: text("task_id").notNull(),
    category: taskCategory().notNull(),
    correct: integer().notNull(),
    total: integer().notNull(),
    durationMs: integer("duration_ms").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    operationId: text("operation_id").notNull(),
  },
  (table) => [
    unique("task_observations_session_step_unique").on(table.sessionId, table.protocolStepIndex),
    unique("task_observations_user_operation_unique").on(table.userId, table.operationId),
    check(
      "task_observations_values_valid",
      sql`${table.protocolStepIndex} >= 0 and ${table.correct} >= 0 and ${table.total} >= ${table.correct} and ${table.durationMs} >= 0`,
    ),
  ],
);

export const followUpObservations = pgTable(
  "follow_up_observations",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => wakeSessions.id, { onDelete: "cascade" }),
    outcome: followUpOutcome().notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    minutesAfterCompletion: integer("minutes_after_completion").notNull(),
    operationId: text("operation_id").notNull(),
  },
  (table) => [
    unique("follow_up_observations_session_unique").on(table.sessionId),
    unique("follow_up_observations_user_operation_unique").on(table.userId, table.operationId),
    check("follow_up_delay_nonnegative", sql`${table.minutesAfterCompletion} >= 0`),
  ],
);

export const followUpNotificationDeliveries = pgTable(
  "follow_up_notification_deliveries",
  {
    id: uuid().defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => wakeSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: notificationDeliveryStatus().notNull(),
    attempts: integer().notNull().default(1),
    retryAt: timestamp("retry_at", { withTimezone: true }),
    telegramMessageId: bigint("telegram_message_id", { mode: "bigint" }),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    unique("follow_up_notification_deliveries_session_unique").on(table.sessionId),
    index("follow_up_notification_deliveries_due_idx").on(table.status, table.retryAt),
    index("follow_up_notification_deliveries_created_idx").on(table.createdAt),
    check(
      "follow_up_notification_deliveries_attempts_range",
      sql`${table.attempts} between 1 and 2`,
    ),
  ],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    operationId: text("operation_id").notNull(),
    commandType: text("command_type").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.operationId] })],
);

export const analyticsProjections = pgTable(
  "analytics_projections",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metricKey: text("metric_key").notNull(),
    subjectKey: text("subject_key").notNull(),
    methodVersion: text("method_version").notNull(),
    value: jsonb().notNull(),
    evidenceCount: integer("evidence_count").notNull(),
    evidenceIds: jsonb("evidence_ids").notNull(),
    confidence: confidence().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    staleAt: timestamp("stale_at", { withTimezone: true }),
  },
  (table) => [
    index("analytics_projections_user_idx").on(table.userId),
    check("analytics_evidence_count_nonnegative", sql`${table.evidenceCount} >= 0`),
  ],
);

export const coachInsights = pgTable("coach_insights", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  evidenceFingerprint: text("evidence_fingerprint").notNull(),
  summary: text().notNull(),
  nextExperiment: text("next_experiment").notNull(),
  caveat: text().notNull(),
  model: text().notNull(),
  evidenceCount: integer("evidence_count").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const legalAcceptances = pgTable("legal_acceptances", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  privacyVersion: text("privacy_version").notNull(),
  termsVersion: text("terms_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billingCheckouts = pgTable(
  "billing_checkouts",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planKey: text("plan_key").notNull(),
    priceStars: integer("price_stars").notNull(),
    status: billingCheckoutStatus().notNull().default("pending"),
    invoiceUrl: text("invoice_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [
    index("billing_checkouts_user_idx").on(table.userId, table.createdAt),
    check("billing_checkouts_price_positive", sql`${table.priceStars} > 0`),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    planKey: text("plan_key").notNull(),
    status: subscriptionStatus().notNull(),
    priceStars: integer("price_stars").notNull(),
    telegramPaymentChargeId: text("telegram_payment_charge_id").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("subscriptions_charge_unique").on(table.telegramPaymentChargeId),
    check("subscriptions_price_positive", sql`${table.priceStars} > 0`),
  ],
);

export const telegramPaymentUpdates = pgTable("telegram_payment_updates", {
  updateId: bigint("update_id", { mode: "bigint" }).primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const telegramStarPayments = pgTable(
  "telegram_star_payments",
  {
    telegramPaymentChargeId: text("telegram_payment_charge_id").primaryKey(),
    updateId: bigint("update_id", { mode: "bigint" }).notNull(),
    checkoutId: uuid("checkout_id")
      .notNull()
      .references(() => billingCheckouts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountStars: integer("amount_stars").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    isRecurring: boolean("is_recurring").notNull(),
  },
  (table) => [
    unique("telegram_star_payments_update_unique").on(table.updateId),
    index("telegram_star_payments_user_paid_idx").on(table.userId, table.paidAt),
    check("telegram_star_payments_amount_positive", sql`${table.amountStars} > 0`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    aggregateId: uuid("aggregate_id"),
    correlationId: text("correlation_id").notNull(),
    metadata: jsonb().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_events_user_idx").on(table.userId)],
);
