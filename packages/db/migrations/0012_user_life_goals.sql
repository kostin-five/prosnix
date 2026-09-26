CREATE TABLE "user_life_goals" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "text" text DEFAULT '' NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_life_goals_revision_positive" CHECK ("revision" > 0),
  CONSTRAINT "user_life_goals_text_length" CHECK (char_length("text") <= 120)
);
