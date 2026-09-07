CREATE TABLE "pro_interest_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "offer_version" text NOT NULL,
  "intent" text NOT NULL,
  "interest_focus" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pro_interest_responses_user_offer_unique" UNIQUE("user_id", "offer_version"),
  CONSTRAINT "pro_interest_responses_intent_valid" CHECK ("pro_interest_responses"."intent" in ('interested', 'not_now', 'not_interested')),
  CONSTRAINT "pro_interest_responses_focus_valid" CHECK ("pro_interest_responses"."interest_focus" is null or "pro_interest_responses"."interest_focus" in ('long_history', 'deeper_experiments', 'both')),
  CONSTRAINT "pro_interest_responses_focus_matches_intent" CHECK (("pro_interest_responses"."intent" = 'interested' and "pro_interest_responses"."interest_focus" is not null) or ("pro_interest_responses"."intent" <> 'interested' and "pro_interest_responses"."interest_focus" is null))
);
--> statement-breakpoint
ALTER TABLE "pro_interest_responses" ADD CONSTRAINT "pro_interest_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pro_interest_responses_created_idx" ON "pro_interest_responses" USING btree ("created_at");
