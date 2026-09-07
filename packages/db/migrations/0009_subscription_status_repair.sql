ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'past_due' BEFORE 'expired';
