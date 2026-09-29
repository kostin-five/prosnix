ALTER TABLE "task_observations"
  ADD COLUMN "completion_source" text DEFAULT 'manual' NOT NULL;

ALTER TABLE "task_observations"
  ADD CONSTRAINT "task_observations_completion_source_valid"
  CHECK ("completion_source" IN ('manual', 'timer'));
