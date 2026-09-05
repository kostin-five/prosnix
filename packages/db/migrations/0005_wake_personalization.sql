CREATE TYPE "public"."wake_context" AS ENUM('unspecified', 'night_sleep', 'short_nap', 'long_nap', 'energy_reset');
--> statement-breakpoint
CREATE TYPE "public"."movement_level" AS ENUM('none', 'light', 'full');
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD COLUMN "wake_context" "wake_context" DEFAULT 'unspecified' NOT NULL;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD COLUMN "duration_budget_minutes" integer DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD COLUMN "personalization_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD CONSTRAINT "wake_sessions_duration_budget_valid" CHECK ("wake_sessions"."duration_budget_minutes" in (2, 5, 10));
--> statement-breakpoint
CREATE TABLE "wake_capability_profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "movement_level" "movement_level" DEFAULT 'none' NOT NULL,
  "available_resources" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "excluded_task_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "default_duration_minutes" integer DEFAULT 5 NOT NULL,
  "onboarding_completed_at" timestamp with time zone,
  "revision" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wake_capability_profiles_duration_valid" CHECK ("wake_capability_profiles"."default_duration_minutes" in (2, 5, 10)),
  CONSTRAINT "wake_capability_profiles_revision_positive" CHECK ("wake_capability_profiles"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "wake_routines" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wake_routines_revision_positive" CHECK ("wake_routines"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "wake_routine_runs" (
  "session_id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "items_snapshot" jsonb NOT NULL,
  "completed_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "wake_routine_runs_revision_positive" CHECK ("wake_routine_runs"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "wake_capability_profiles" ADD CONSTRAINT "wake_capability_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wake_routines" ADD CONSTRAINT "wake_routines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wake_routine_runs" ADD CONSTRAINT "wake_routine_runs_session_id_wake_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wake_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wake_routine_runs" ADD CONSTRAINT "wake_routine_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "wake_routine_runs_user_idx" ON "wake_routine_runs" USING btree ("user_id", "updated_at");
