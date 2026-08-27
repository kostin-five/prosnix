CREATE TYPE "public"."confidence" AS ENUM('insufficient', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."experiment_phase" AS ENUM('learning', 'adaptive', 'fallback');--> statement-breakpoint
CREATE TYPE "public"."follow_up_outcome" AS ENUM('up', 'back', 'drowsy');--> statement-breakpoint
CREATE TYPE "public"."rating_kind" AS ENUM('baseline', 'post_protocol');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('assigned', 'in_progress', 'protocol_completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."task_category" AS ENUM('cognitive', 'movement', 'behavioral', 'environment');--> statement-breakpoint
CREATE TABLE "analytics_projections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric_key" text NOT NULL,
	"subject_key" text NOT NULL,
	"method_version" text NOT NULL,
	"value" jsonb NOT NULL,
	"evidence_count" integer NOT NULL,
	"evidence_ids" jsonb NOT NULL,
	"confidence" "confidence" NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stale_at" timestamp with time zone,
	CONSTRAINT "analytics_evidence_count_nonnegative" CHECK ("analytics_projections"."evidence_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"aggregate_id" uuid,
	"correlation_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"protocol_definition_id" uuid NOT NULL,
	"strategy_version" text NOT NULL,
	"phase" "experiment_phase" NOT NULL,
	"hypothesis" text NOT NULL,
	"evaluated_factor" text,
	"comparison_group_key" text,
	"comparison_level" text,
	"evidence_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"outcome" "follow_up_outcome" NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"minutes_after_completion" integer NOT NULL,
	"operation_id" text NOT NULL,
	CONSTRAINT "follow_up_observations_session_unique" UNIQUE("session_id"),
	CONSTRAINT "follow_up_observations_user_operation_unique" UNIQUE("user_id","operation_id"),
	CONSTRAINT "follow_up_delay_nonnegative" CHECK ("follow_up_observations"."minutes_after_completion" >= 0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"user_id" uuid NOT NULL,
	"operation_id" text NOT NULL,
	"command_type" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_records_user_id_operation_id_pk" PRIMARY KEY("user_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "protocol_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_key" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"steps" jsonb NOT NULL,
	"active_from" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "protocol_definitions_key_version_unique" UNIQUE("protocol_key","version"),
	CONSTRAINT "protocol_definitions_version_positive" CHECK ("protocol_definitions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "rating_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" "rating_kind" NOT NULL,
	"value" integer NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_observed_at" timestamp with time zone,
	"operation_id" text NOT NULL,
	CONSTRAINT "rating_observations_session_kind_unique" UNIQUE("session_id","kind"),
	CONSTRAINT "rating_observations_user_operation_unique" UNIQUE("user_id","operation_id"),
	CONSTRAINT "rating_observations_value_range" CHECK ("rating_observations"."value" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "task_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"protocol_step_index" integer NOT NULL,
	"task_id" text NOT NULL,
	"category" "task_category" NOT NULL,
	"correct" integer NOT NULL,
	"total" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operation_id" text NOT NULL,
	CONSTRAINT "task_observations_session_step_unique" UNIQUE("session_id","protocol_step_index"),
	CONSTRAINT "task_observations_user_operation_unique" UNIQUE("user_id","operation_id"),
	CONSTRAINT "task_observations_values_valid" CHECK ("task_observations"."protocol_step_index" >= 0 and "task_observations"."correct" >= 0 and "task_observations"."total" >= "task_observations"."correct" and "task_observations"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"locale" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"learning_session_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	CONSTRAINT "users_telegram_user_id_unique" UNIQUE("telegram_user_id"),
	CONSTRAINT "users_learning_count_nonnegative" CHECK ("users"."learning_session_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wake_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"status" "session_status" DEFAULT 'assigned' NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone,
	"protocol_completed_at" timestamp with time zone,
	"follow_up_due_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wake_sessions_assignment_unique" UNIQUE("assignment_id"),
	CONSTRAINT "wake_sessions_step_nonnegative" CHECK ("wake_sessions"."current_step_index" >= 0),
	CONSTRAINT "wake_sessions_version_positive" CHECK ("wake_sessions"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "analytics_projections" ADD CONSTRAINT "analytics_projections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_protocol_definition_id_protocol_definitions_id_fk" FOREIGN KEY ("protocol_definition_id") REFERENCES "public"."protocol_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_observations" ADD CONSTRAINT "follow_up_observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_observations" ADD CONSTRAINT "follow_up_observations_session_id_wake_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wake_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_observations" ADD CONSTRAINT "rating_observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_observations" ADD CONSTRAINT "rating_observations_session_id_wake_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wake_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_observations" ADD CONSTRAINT "task_observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_observations" ADD CONSTRAINT "task_observations_session_id_wake_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wake_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD CONSTRAINT "wake_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD CONSTRAINT "wake_sessions_assignment_id_experiment_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."experiment_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_projections_user_idx" ON "analytics_projections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_user_idx" ON "audit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "experiment_assignments_user_idx" ON "experiment_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wake_sessions_one_active_per_user" ON "wake_sessions" USING btree ("user_id") WHERE "wake_sessions"."status" in ('assigned', 'in_progress');