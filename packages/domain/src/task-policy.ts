import type { TaskId, WakeDurationMinutes } from "./model.js";

export const STRICT_TASK_PROTOCOL_VERSION = 3;

const BASE_ESTIMATED_SECONDS: Record<TaskId, number> = {
  math: 60,
  memory: 60,
  stroop: 45,
  reaction: 30,
  steps: 30,
  squats: 30,
  shake: 20,
  water: 45,
  window: 40,
  curtains: 20,
};

const TEN_MINUTE_ESTIMATED_SECONDS: Record<TaskId, number> = {
  math: 100,
  memory: 100,
  stroop: 75,
  reaction: 50,
  steps: 60,
  squats: 50,
  shake: 30,
  water: 55,
  window: 60,
  curtains: 30,
};

export function taskSuccessTarget(taskId: TaskId, durationMinutes: WakeDurationMinutes): number {
  if (taskId === "memory") return durationMinutes === 10 ? 3 : 2;
  if (taskId === "math" || taskId === "stroop" || taskId === "reaction") {
    return durationMinutes === 10 ? 5 : 3;
  }
  return 1;
}

export function estimatedTaskSeconds(taskId: TaskId, durationMinutes: WakeDurationMinutes): number {
  return durationMinutes === 10
    ? TEN_MINUTE_ESTIMATED_SECONDS[taskId]
    : BASE_ESTIMATED_SECONDS[taskId];
}
