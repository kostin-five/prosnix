CREATE TYPE "public"."bot_status" AS ENUM('unknown', 'available', 'blocked');
--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('sending', 'retry_wait', 'sent', 'blocked', 'ambiguous', 'failed', 'skipped');
--> statement-breakpoint
CREATE TABLE "wake_schedules" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"local_time" text NOT NULL,
	"timezone" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"next_trigger_at" timestamp with time zone,
	"bot_status" "bot_status" DEFAULT 'unknown' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wake_schedules_time_format" CHECK ("wake_schedules"."local_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "wake_schedules_revision_positive" CHECK ("wake_schedules"."revision" > 0),
	CONSTRAINT "wake_schedules_enabled_trigger" CHECK (not "wake_schedules"."enabled" or "wake_schedules"."next_trigger_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_user_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "notification_delivery_status" NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"retry_at" timestamp with time zone,
	"telegram_message_id" bigint,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notification_deliveries_schedule_time_unique" UNIQUE("schedule_user_id","scheduled_for"),
	CONSTRAINT "notification_deliveries_attempts_range" CHECK ("notification_deliveries"."attempts" between 1 and 2)
);
--> statement-breakpoint
ALTER TABLE "wake_schedules" ADD CONSTRAINT "wake_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_schedule_user_id_wake_schedules_user_id_fk" FOREIGN KEY ("schedule_user_id") REFERENCES "public"."wake_schedules"("user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "wake_schedules_due_idx" ON "wake_schedules" USING btree ("next_trigger_at");
--> statement-breakpoint
CREATE INDEX "notification_deliveries_retry_idx" ON "notification_deliveries" USING btree ("status","retry_at");
