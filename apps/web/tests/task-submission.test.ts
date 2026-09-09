import { describe, expect, it } from "vitest";

import {
  TaskSubmissionGate,
  taskSubmissionConflictMessage,
} from "../src/features/session/task-submission-gate.js";

describe("single-flight результата задания", () => {
  it("принимает только первый callback текущего шага", () => {
    const gate = new TaskSubmissionGate();

    expect(gate.acquire("reaction", "reaction")).toBe(true);
    expect(gate.acquire("reaction", "reaction")).toBe(false);
  });

  it("не принимает запоздалый callback предыдущего задания", () => {
    const gate = new TaskSubmissionGate();

    expect(gate.acquire("memory", "reaction")).toBe(false);
    expect(gate.acquire("memory", "memory")).toBe(true);
  });

  it("разрешает честный повтор после server conflict", () => {
    const gate = new TaskSubmissionGate();
    expect(gate.acquire("reaction", "reaction")).toBe(true);

    gate.reset();

    expect(gate.acquire("reaction", "reaction")).toBe(true);
  });

  it("отличает непринятый результат от синхронизации версии", () => {
    expect(taskSubmissionConflictMessage("invalid_transition", 2, 2)).toContain(
      "Задание перезапущено",
    );
    expect(taskSubmissionConflictMessage("stale_version", 2, 3)).toContain("синхронизировано");
  });
});
