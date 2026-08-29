export interface WakeScheduleValue {
  userId: string;
  localTime: string;
  timezone: string;
  enabled: boolean;
  nextTriggerAt: Date | null;
  botStatus: "unknown" | "available" | "blocked";
  revision: number;
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function localParts(date: Date, timezone: string) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function nextCalendarDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 1));
  return next.toISOString().slice(0, 10);
}

export function nextDailyTrigger(localTime: string, timezone: string, after: Date): Date {
  if (!TIME_PATTERN.test(localTime)) throw new Error("invalid_local_time");
  if (!isValidTimeZone(timezone)) throw new Error("invalid_timezone");
  const [hours, minutes] = localTime.split(":").map(Number);
  const targetMinutes = hours! * 60 + minutes!;
  const current = localParts(after, timezone);
  const targetDate =
    current.minutes < targetMinutes ? current.date : nextCalendarDate(current.date);
  const firstMinute = Math.floor(after.getTime() / 60_000) * 60_000 + 60_000;
  let firstLaterOnTargetDate: Date | null = null;

  for (let offset = 0; offset <= 36 * 60; offset += 1) {
    const candidate = new Date(firstMinute + offset * 60_000);
    const local = localParts(candidate, timezone);
    if (local.date !== targetDate) {
      if (firstLaterOnTargetDate && local.date > targetDate) return firstLaterOnTargetDate;
      continue;
    }
    if (local.minutes === targetMinutes) return candidate;
    if (local.minutes > targetMinutes && !firstLaterOnTargetDate) {
      firstLaterOnTargetDate = candidate;
    }
  }

  if (firstLaterOnTargetDate) return firstLaterOnTargetDate;
  throw new Error("next_trigger_not_found");
}

export function scheduleNextTrigger(
  input: { localTime: string; timezone: string; enabled: boolean },
  now: Date,
): Date | null {
  if (!TIME_PATTERN.test(input.localTime)) throw new Error("invalid_local_time");
  if (!isValidTimeZone(input.timezone)) throw new Error("invalid_timezone");
  return input.enabled ? nextDailyTrigger(input.localTime, input.timezone, now) : null;
}
