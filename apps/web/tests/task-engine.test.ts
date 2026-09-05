import { describe, expect, it } from "vitest";

import {
  adaptDifficulty,
  makeMathQuestion,
  makeMemorySequence,
  memoryLength,
} from "../src/features/tasks/task-engine.js";

describe("адаптивные задания", () => {
  it("создаёт один правильный и два различных неверных варианта", () => {
    const question = makeMathQuestion(3, () => 0.42);
    expect(question.options).toHaveLength(3);
    expect(new Set(question.options).size).toBe(3);
    expect(question.options).toContain(question.answer);
  });

  it("меняет сложность только после устойчивой серии", () => {
    expect(adaptDifficulty(1, 2, 0)).toBe(2);
    expect(adaptDifficulty(3, 0, 2)).toBe(2);
    expect(adaptDifficulty(2, 1, 0)).toBe(2);
    expect(adaptDifficulty(3, 2, 0)).toBe(3);
  });

  it("увеличивает объём памяти в ограниченном диапазоне", () => {
    expect(memoryLength(1)).toBe(4);
    expect(memoryLength(3)).toBe(6);
    expect(makeMemorySequence(2, () => 0.1)).toHaveLength(5);
  });
});
