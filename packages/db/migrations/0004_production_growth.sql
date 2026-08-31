CREATE TYPE "public"."billing_checkout_status" AS ENUM('pending', 'paid', 'expired', 'canceled');
--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'past_due', 'expired', 'refunded');
--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"privacy_version" text NOT NULL,
	"terms_version" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_key" text NOT NULL,
	"price_stars" integer NOT NULL,
	"status" "billing_checkout_status" DEFAULT 'pending' NOT NULL,
	"invoice_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "billing_checkouts_price_positive" CHECK ("billing_checkouts"."price_stars" > 0)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plan_key" text NOT NULL,
	"status" "subscription_status" NOT NULL,
	"price_stars" integer NOT NULL,
	"telegram_payment_charge_id" text NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_charge_unique" UNIQUE("telegram_payment_charge_id"),
	CONSTRAINT "subscriptions_price_positive" CHECK ("subscriptions"."price_stars" > 0)
);
--> statement-breakpoint
CREATE TABLE "telegram_payment_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_star_payments" (
	"telegram_payment_charge_id" text PRIMARY KEY NOT NULL,
	"update_id" bigint NOT NULL,
	"checkout_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_stars" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"is_recurring" boolean NOT NULL,
	CONSTRAINT "telegram_star_payments_update_unique" UNIQUE("update_id"),
	CONSTRAINT "telegram_star_payments_amount_positive" CHECK ("telegram_star_payments"."amount_stars" > 0)
);
--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD CONSTRAINT "billing_checkouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "telegram_star_payments" ADD CONSTRAINT "telegram_star_payments_checkout_id_billing_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."billing_checkouts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "telegram_star_payments" ADD CONSTRAINT "telegram_star_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "billing_checkouts_user_idx" ON "billing_checkouts" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "telegram_star_payments_user_paid_idx" ON "telegram_star_payments" USING btree ("user_id","paid_at");
