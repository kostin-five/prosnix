import { describe, expect, it } from "vitest";

import { estimatedTaskSeconds, taskSuccessTarget } from "../src/task-policy.js";

describe("нагрузка заданий", () => {
  it("сохраняет прежние цели для старых версий и увеличивает их в версии 10", () => {
    expect(taskSuccessTarget("math", 2)).toBe(3);
    expect(taskSuccessTarget("stroop", 5)).toBe(3);
    expect(taskSuccessTarget("reaction", 10)).toBe(5);
    expect(taskSuccessTarget("memory", 5)).toBe(2);
    expect(taskSuccessTarget("memory", 10)).toBe(3);
    expect(taskSuccessTarget("steps", 10)).toBe(1);
    expect(taskSuccessTarget("stroop", 5, 9)).toBe(3);
    expect(taskSuccessTarget("stroop", 5, 10)).toBe(4);
    expect(taskSuccessTarget("memory", 5, 10)).toBe(3);
    expect(estimatedTaskSeconds("steps", 5, 10)).toBe(45);
  });

  it("даёт 10-минутному режиму большую оценочную нагрузку", () => {
    for (const taskId of ["math", "memory", "stroop", "reaction", "steps", "window"] as const) {
      expect(estimatedTaskSeconds(taskId, 10)).toBeGreaterThan(estimatedTaskSeconds(taskId, 5));
    }
  });

  it("сокращает только новые безэкранные задания наблюдения", () => {
    expect(estimatedTaskSeconds("notice_three", 2, 11)).toBe(60);
    expect(estimatedTaskSeconds("find_color", 10, 11)).toBe(90);
    for (const duration of [2, 5, 10] as const) {
      expect(estimatedTaskSeconds("notice_three", duration, 12)).toBe(15);
      expect(estimatedTaskSeconds("find_color", duration, 12)).toBe(25);
    }
  });
});
