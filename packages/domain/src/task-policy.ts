import type { TaskId, WakeDurationMinutes } from "./model.js";

export const STRICT_TASK_PROTOCOL_VERSION = 3;
export const COMPACT_FIVE_MINUTE_PROTOCOL_VERSION = 10;
export const SHORT_OBSERVATION_PROTOCOL_VERSION = 12;

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
  sit_edge: 10,
  cool_wash: 20,
  pushups: 25,
  notice_three: 60,
  find_color: 60,
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
  sit_edge: 10,
  cool_wash: 30,
  pushups: 30,
  notice_three: 90,
  find_color: 90,
};

const COMPACT_FIVE_MINUTE_ESTIMATED_SECONDS: Record<TaskId, number> = {
  math: 70,
  memory: 70,
  stroop: 60,
  reaction: 50,
  steps: 45,
  squats: 45,
  shake: 35,
  water: 50,
  window: 50,
  curtains: 30,
  sit_edge: 10,
  cool_wash: 40,
  pushups: 40,
  notice_three: 60,
  find_color: 60,
};

export function taskSuccessTarget(
  taskId: TaskId,
  durationMinutes: WakeDurationMinutes,
  protocolVersion = 8,
): number {
  if (durationMinutes === 5 && protocolVersion >= COMPACT_FIVE_MINUTE_PROTOCOL_VERSION) {
    if (taskId === "memory") return 3;
    if (taskId === "math" || taskId === "stroop" || taskId === "reaction") return 4;
  }
  if (taskId === "memory") return durationMinutes === 10 ? 3 : 2;
  if (taskId === "math" || taskId === "stroop" || taskId === "reaction") {
    return durationMinutes === 10 ? 5 : 3;
  }
  return 1;
}

export function estimatedTaskSeconds(
  taskId: TaskId,
  durationMinutes: WakeDurationMinutes,
  protocolVersion = 8,
): number {
  if (protocolVersion >= SHORT_OBSERVATION_PROTOCOL_VERSION) {
    if (taskId === "notice_three") return 15;
    if (taskId === "find_color") return 25;
  }
  if (durationMinutes === 5 && protocolVersion >= COMPACT_FIVE_MINUTE_PROTOCOL_VERSION) {
    return COMPACT_FIVE_MINUTE_ESTIMATED_SECONDS[taskId];
  }
  return durationMinutes === 10
    ? TEN_MINUTE_ESTIMATED_SECONDS[taskId]
    : BASE_ESTIMATED_SECONDS[taskId];
}
