import type { WakeScheduleInput, WakeScheduleResponse } from "@awc/contracts";
import { scheduleNextTrigger, type WakeScheduleRepository } from "@awc/domain";

export class ScheduleInputError extends Error {
  readonly statusCode = 400;
  readonly code = "invalid_wake_schedule";
}

export class ScheduleSnoozeError extends Error {
  readonly statusCode = 409;
  readonly code = "wake_schedule_not_enabled";
}

export class ScheduleSnoozeConflictError extends Error {
  readonly statusCode = 409;
  readonly code = "idempotency_conflict";
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

  async snooze(userId: string, operationId: string): Promise<WakeScheduleResponse> {
    const now = this.now();
    const result = await this.repository.snooze(
      userId,
      operationId,
      new Date(now.getTime() + 5 * 60_000),
      now,
    );
    if (result.status === "not_enabled") {
      throw new ScheduleSnoozeError("Сначала включи Telegram-напоминание в настройках");
    }
    if (result.status === "idempotency_conflict") {
      throw new ScheduleSnoozeConflictError("Ключ операции уже использован другим запросом");
    }
    return response(result.schedule)!;
  }
}
