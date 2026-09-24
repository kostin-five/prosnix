ALTER TABLE "wake_sessions" ADD COLUMN "recovery_offer_declined_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "wake_sessions" ADD CONSTRAINT "wake_sessions_recovery_decline_primary_only" CHECK (
  "recovery_offer_declined_at" IS NULL OR "session_kind" = 'primary'
);
