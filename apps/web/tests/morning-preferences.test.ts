import { beforeEach, describe, expect, it } from "vitest";

import {
  clearMorningPreferences,
  handleEarlyCalibration,
  readDueEarlyCalibration,
  readMorningGoal,
  readNextEarlyCalibration,
  saveMorningGoal,
  scheduleEarlyCalibration,
} from "../src/features/personalization/morning-preferences.js";

describe("локальная утренняя цель и ранняя калибровка", () => {
  beforeEach(() => window.localStorage.clear());

  it("хранит короткую цель отдельно для каждого профиля", () => {
    expect(saveMorningGoal("user-a", "  Закончить   важный проект  ")).toBe(
      "Закончить важный проект",
    );
    expect(readMorningGoal("user-a")).toBe("Закончить важный проект");
    expect(readMorningGoal("user-b")).toBe("");
  });

  it("планирует локальную вечернюю карточку только после первых трёх сессий", () => {
    const morning = new Date(2026, 8, 23, 8, 30);
    const first = scheduleEarlyCalibration("user-a", 1, morning);
    expect(first).not.toBeNull();
    expect(new Date(first!.dueAt).getHours()).toBe(18);
    expect(readDueEarlyCalibration("user-a", new Date(2026, 8, 23, 17, 59))).toBeNull();
    expect(readDueEarlyCalibration("user-a", new Date(2026, 8, 23, 18, 0))).toMatchObject({
      sessionNumber: 1,
    });

    handleEarlyCalibration("user-a", 1);
    expect(readDueEarlyCalibration("user-a", new Date(2026, 8, 23, 20, 0))).toBeNull();
    expect(scheduleEarlyCalibration("user-a", 4, morning)).toBeNull();
  });

  it("не дублирует одну проверку и удаляет локальные данные вместе с профилем", () => {
    const evening = new Date(2026, 8, 23, 20, 0);
    const first = scheduleEarlyCalibration("user-a", 2, evening);
    const repeated = scheduleEarlyCalibration("user-a", 2, evening);
    expect(repeated).toEqual(first);
    expect(readNextEarlyCalibration("user-a")?.sessionNumber).toBe(2);
    saveMorningGoal("user-a", "Встать ради тренировки");

    clearMorningPreferences("user-a");

    expect(readMorningGoal("user-a")).toBe("");
    expect(readNextEarlyCalibration("user-a")).toBeNull();
  });
});
