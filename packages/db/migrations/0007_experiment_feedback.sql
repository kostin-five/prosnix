create table "experiment_feedback" (
  "user_id" uuid not null references "users"("id") on delete cascade,
  "experiment_version" text not null,
  "helpful" integer not null check ("helpful" between 1 and 5),
  "irritating" integer not null check ("irritating" between 1 and 5),
  "continue_intent" integer not null check ("continue_intent" between 1 and 5),
  "created_at" timestamptz not null default now(),
  primary key ("user_id", "experiment_version")
);
