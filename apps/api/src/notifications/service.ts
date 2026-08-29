import type { WakeScheduleInput, WakeScheduleResponse } from "@awc/contracts";
import { scheduleNextTrigger, type WakeScheduleRepository } from "@awc/domain";

export class ScheduleInputError extends Error {
  readonly statusCode = 400;
  readonly code = "invalid_wake_schedule";
}

function response(schedule: Awaited<ReturnType<WakeScheduleRepository["findByUserId"]>>) {
  if (!schedule) return null;
  return {
    localTime: schedule.localTime,
    timezone: schedule.timezone,
    enabled: schedule.enabled,
    nextTriggerAt: schedule.nextTriggerAt?.toISOString() ?? null,
    botStatus: schedule.botStatus,
    revision: schedule.revision,
  } satisfies WakeScheduleResponse;
}

export class WakeScheduleService {
  constructor(
    private readonly repository: WakeScheduleRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(userId: string): Promise<WakeScheduleResponse | null> {
    return response(await this.repository.findByUserId(userId));
  }

  async save(userId: string, input: WakeScheduleInput): Promise<WakeScheduleResponse> {
    const now = this.now();
    let nextTriggerAt: Date | null;
    try {
      nextTriggerAt = scheduleNextTrigger(input, now);
    } catch {
      throw new ScheduleInputError("Проверь время и часовой пояс");
    }
    const saved = await this.repository.save({ ...input, userId, nextTriggerAt, now });
    return response(saved)!;
  }
}
