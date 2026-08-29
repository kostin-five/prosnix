import { describe, expect, it } from "vitest";

import { isValidTimeZone, nextDailyTrigger, scheduleNextTrigger } from "../src/index.js";

describe("daily wake schedule", () => {
  it("finds the next local time in a fixed-offset day", () => {
    expect(nextDailyTrigger("07:00", "Europe/Moscow", new Date("2026-08-29T03:30:10Z"))).toEqual(
      new Date("2026-08-29T04:00:00Z"),
    );
  });

  it("moves to the next local day after today's time", () => {
    expect(nextDailyTrigger("07:00", "Europe/Moscow", new Date("2026-08-29T05:00:00Z"))).toEqual(
      new Date("2026-08-30T04:00:00Z"),
    );
  });

  it("uses the first real minute after a missing DST time", () => {
    expect(nextDailyTrigger("02:30", "Europe/Berlin", new Date("2026-03-28T23:00:00Z"))).toEqual(
      new Date("2026-03-29T01:00:00Z"),
    );
  });

  it("selects only the first occurrence of an ambiguous DST time", () => {
    expect(nextDailyTrigger("02:30", "Europe/Berlin", new Date("2026-10-24T22:00:00Z"))).toEqual(
      new Date("2026-10-25T00:30:00Z"),
    );
  });

  it("validates timezone and disabled schedules", () => {
    expect(isValidTimeZone("Europe/Moscow")).toBe(true);
    expect(isValidTimeZone("Moon/Sea_of_Tranquility")).toBe(false);
    expect(
      scheduleNextTrigger(
        { localTime: "07:00", timezone: "Europe/Moscow", enabled: false },
        new Date(),
      ),
    ).toBeNull();
    expect(() =>
      scheduleNextTrigger({ localTime: "25:00", timezone: "UTC", enabled: true }, new Date()),
    ).toThrow("invalid_local_time");
  });
});
