CREATE TYPE "public"."session_kind" AS ENUM('primary', 'recovery');
--> statement-breakpoint
CREATE TYPE "public"."task_substitution_reason" AS ENUM('unwilling_now', 'not_helpful', 'cannot_do');
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD COLUMN "experience_snapshot" jsonb DEFAULT '{"soundMode":"unknown"}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD COLUMN "session_kind" "session_kind" DEFAULT 'primary' NOT NULL;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD COLUMN "parent_session_id" uuid;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD COLUMN "baseline_source_session_id" uuid;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD COLUMN "baseline_source_rating_kind" "rating_kind";
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD CONSTRAINT "wake_sessions_id_user_unique" UNIQUE("id", "user_id");
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD CONSTRAINT "wake_sessions_parent_owner_fk"
  FOREIGN KEY ("parent_session_id", "user_id")
  REFERENCES "public"."wake_sessions"("id", "user_id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD CONSTRAINT "wake_sessions_baseline_source_owner_fk"
  FOREIGN KEY ("baseline_source_session_id", "user_id")
  REFERENCES "public"."wake_sessions"("id", "user_id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD CONSTRAINT "wake_sessions_recovery_shape_valid" CHECK (
  (
    "session_kind" = 'primary'
    AND "parent_session_id" IS NULL
    AND "baseline_source_session_id" IS NULL
    AND "baseline_source_rating_kind" IS NULL
  ) OR (
    "session_kind" = 'recovery'
    AND "parent_session_id" IS NOT NULL
    AND "baseline_source_session_id" = "parent_session_id"
    AND "baseline_source_rating_kind" = 'post_protocol'
  )
);
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD CONSTRAINT "wake_sessions_parent_not_self"
  CHECK ("parent_session_id" IS NULL OR "parent_session_id" <> "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "wake_sessions_one_recovery_per_parent"
  ON "wake_sessions" USING btree ("parent_session_id")
  WHERE "session_kind" = 'recovery';
--> statement-breakpoint
CREATE TABLE "session_task_substitutions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "step_index" integer NOT NULL,
  "original_task_id" text NOT NULL,
  "replacement_task_id" text NOT NULL,
  "reason" "task_substitution_reason" NOT NULL,
  "operation_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "session_task_substitutions_user_operation_unique" UNIQUE("user_id", "operation_id"),
  CONSTRAINT "session_task_substitutions_step_nonnegative" CHECK ("step_index" >= 0),
  CONSTRAINT "session_task_substitutions_changes_task" CHECK ("original_task_id" <> "replacement_task_id")
);
--> statement-breakpoint
ALTER TABLE "session_task_substitutions" ADD CONSTRAINT "session_task_substitutions_session_owner_fk"
  FOREIGN KEY ("session_id", "user_id")
  REFERENCES "public"."wake_sessions"("id", "user_id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "session_task_substitutions_session_created_idx"
  ON "session_task_substitutions" USING btree ("session_id", "created_at");
