alter table "task_observations"
  add column "difficulty_level" integer;

alter table "task_observations"
  add constraint "task_observations_difficulty_valid"
  check ("difficulty_level" is null or "difficulty_level" between 1 and 3);
