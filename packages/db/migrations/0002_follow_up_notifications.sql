CREATE TABLE "follow_up_notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "notification_delivery_status" NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"retry_at" timestamp with time zone,
	"telegram_message_id" bigint,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "follow_up_notification_deliveries_session_unique" UNIQUE("session_id"),
	CONSTRAINT "follow_up_notification_deliveries_attempts_range" CHECK ("follow_up_notification_deliveries"."attempts" between 1 and 2)
);
--> statement-breakpoint
ALTER TABLE "follow_up_notification_deliveries" ADD CONSTRAINT "follow_up_notification_deliveries_session_id_wake_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wake_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "follow_up_notification_deliveries" ADD CONSTRAINT "follow_up_notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "follow_up_notification_deliveries_due_idx" ON "follow_up_notification_deliveries" USING btree ("status","retry_at");
--> statement-breakpoint
CREATE INDEX "follow_up_notification_deliveries_created_idx" ON "follow_up_notification_deliveries" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "notification_deliveries_created_idx" ON "notification_deliveries" USING btree ("created_at");
