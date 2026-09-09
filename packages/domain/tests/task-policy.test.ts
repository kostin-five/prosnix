import { describe, expect, it } from "vitest";

import { estimatedTaskSeconds, taskSuccessTarget } from "../src/task-policy.js";

describe("нагрузка заданий", () => {
  it("увеличивает цели когнитивных заданий только для 10 минут", () => {
    expect(taskSuccessTarget("math", 2)).toBe(3);
    expect(taskSuccessTarget("stroop", 5)).toBe(3);
    expect(taskSuccessTarget("reaction", 10)).toBe(5);
    expect(taskSuccessTarget("memory", 5)).toBe(2);
    expect(taskSuccessTarget("memory", 10)).toBe(3);
    expect(taskSuccessTarget("steps", 10)).toBe(1);
  });

  it("даёт 10-минутному режиму большую оценочную нагрузку", () => {
    for (const taskId of ["math", "memory", "stroop", "reaction", "steps", "window"] as const) {
      expect(estimatedTaskSeconds(taskId, 10)).toBeGreaterThan(estimatedTaskSeconds(taskId, 5));
    }
  });
});
