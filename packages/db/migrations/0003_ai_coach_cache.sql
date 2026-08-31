CREATE TABLE "coach_insights" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"evidence_fingerprint" text NOT NULL,
	"summary" text NOT NULL,
	"next_experiment" text NOT NULL,
	"caveat" text NOT NULL,
	"model" text NOT NULL,
	"evidence_count" integer NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_insights" ADD CONSTRAINT "coach_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
