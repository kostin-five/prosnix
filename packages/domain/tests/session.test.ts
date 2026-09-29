import { describe, expect, it } from "vitest";

import type { ExperimentAssignment, WakeSession } from "../src/model.js";
import {
  abandonSession,
  acceptBaseline,
  acceptFollowUp,
  acceptPostRating,
  acceptTaskResult,
} from "../src/session/session.js";

const assignment: ExperimentAssignment = {
  id: "assignment-1",
  protocolKey: "learning-cognitive",
  protocolVersion: 1,
  strategyVersion: "learning-v1",
  phase: "learning",
  hypothesis: "Measure a cognitive baseline",
  steps: [
    { index: 0, taskId: "math", category: "cognitive" },
    { index: 1, taskId: "memory", category: "cognitive" },
  ],
};

function assignedSession(): WakeSession {
  return {
    id: "session-1",
    userId: "user-1",
    assignment,
    wakeContext: "night_sleep",
    durationMinutes: 5,
    personalization: {
      profileRevision: 0,
      movementLevel: "none",
      availableResources: [],
      excludedTaskIds: [],
      fallbackReason: "profile_missing",
    },
    status: "assigned",
    currentStepIndex: 0,
    version: 1,
    baseline: null,
    tasks: [],
    postRating: null,
    followUp: null,
    startedAt: null,
    protocolCompletedAt: null,
    followUpDueAt: null,
    abandonedAt: null,
  };
}

describe("wake session transitions", () => {
  it("отличает завершение по таймеру и проверяет режим и длительность", () => {
    const assigned = {
      ...assignedSession(),
      durationMinutes: 2 as const,
      experience: { soundMode: "on" as const, interactionMode: "hands_free" as const },
      assignment: {
        ...assignment,
        protocolVersion: 11,
        steps: [{ index: 0, taskId: "notice_three" as const, category: "behavioral" as const }],
      },
    };
    const session = acceptBaseline(assigned, {
      expectedVersion: 1,
      value: 3,
      observedAt: "2026-09-30T04:00:00.000Z",
    });
    const result = {
      expectedVersion: 2,
      stepIndex: 0,
      taskId: "notice_three" as const,
      correct: 1,
      total: 1,
      durationMs: 60_000,
      completionSource: "timer" as const,
      observedAt: "2026-09-30T04:01:00.000Z",
    };
    expect(acceptTaskResult(session, result).tasks[0]?.completionSource).toBe("timer");
    expect(() => acceptTaskResult(session, { ...result, durationMs: 30_000 })).toThrowError(
      /Автозавершение/,
    );
    expect(() =>
      acceptTaskResult(session, { ...result, observedAt: "2026-09-30T04:00:30.000Z" }),
    ).toThrowError(/Автозавершение/);
    expect(() =>
      acceptTaskResult({ ...session, experience: { soundMode: "on" } }, result),
    ).toThrowError(/Автозавершение/);
  });

  it("проверяет результат по effectiveSteps после замены", () => {
    const session = acceptBaseline(
      {
        ...assignedSession(),
        effectiveSteps: [
          { index: 0, taskId: "reaction", category: "cognitive" },
          assignment.steps[1]!,
        ],
      },
      { expectedVersion: 1, value: 3, observedAt: "2026-09-23T04:00:00.000Z" },
    );

    expect(() =>
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 0,
        taskId: "math",
        correct: 1,
        total: 1,
        durationMs: 1_000,
        observedAt: "2026-09-23T04:00:01.000Z",
      }),
    ).toThrowError(/reaction/);
    expect(
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 0,
        taskId: "reaction",
        correct: 1,
        total: 1,
        durationMs: 1_000,
        observedAt: "2026-09-23T04:00:01.000Z",
      }).tasks[0],
    ).toMatchObject({ taskId: "reaction", category: "cognitive" });
  });

  it("не принимает недостаточный когнитивный результат нового протокола", () => {
    const session = acceptBaseline(
      {
        ...assignedSession(),
        durationMinutes: 10,
        assignment: { ...assignment, protocolVersion: 3 },
      },
      {
        expectedVersion: 1,
        value: 3,
        observedAt: "2026-09-08T04:00:00.000Z",
      },
    );

    expect(() =>
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 0,
        taskId: "math",
        correct: 3,
        total: 3,
        durationMs: 30_000,
        observedAt: "2026-09-08T04:00:30.000Z",
      }),
    ).toThrowError(/5 successful/i);

    expect(
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 0,
        taskId: "math",
        correct: 5,
        total: 7,
        durationMs: 60_000,
        observedAt: "2026-09-08T04:01:00.000Z",
      }).currentStepIndex,
    ).toBe(1);
  });

  it("сохраняет общую валидацию для старого активного протокола", () => {
    const session = acceptBaseline(assignedSession(), {
      expectedVersion: 1,
      value: 3,
      observedAt: "2026-09-08T04:00:00.000Z",
    });

    expect(
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 0,
        taskId: "math",
        correct: 1,
        total: 2,
        durationMs: 10_000,
        observedAt: "2026-09-08T04:00:10.000Z",
      }).currentStepIndex,
    ).toBe(1);
  });

  it("требует четыре успеха только в новой пятиминутной версии", () => {
    const session = acceptBaseline(
      { ...assignedSession(), assignment: { ...assignment, protocolVersion: 10 } },
      { expectedVersion: 1, value: 3, observedAt: "2026-09-26T04:00:00.000Z" },
    );
    expect(() =>
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 0,
        taskId: "math",
        correct: 3,
        total: 3,
        durationMs: 30_000,
        observedAt: "2026-09-26T04:00:30.000Z",
      }),
    ).toThrowError(/4 successful/i);
    expect(
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 0,
        taskId: "math",
        correct: 4,
        total: 4,
        durationMs: 40_000,
        observedAt: "2026-09-26T04:00:40.000Z",
      }).currentStepIndex,
    ).toBe(1);
  });

  it("завершает сохранённый световой шаг curtains старого протокола", () => {
    const session = acceptBaseline(
      {
        ...assignedSession(),
        assignment: {
          ...assignment,
          protocolVersion: 4,
          steps: [{ index: 0, taskId: "curtains", category: "environment" }],
        },
      },
      {
        expectedVersion: 1,
        value: 3,
        observedAt: "2026-09-09T04:00:00.000Z",
      },
    );

    expect(
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 0,
        taskId: "curtains",
        correct: 1,
        total: 1,
        durationMs: 20_000,
        observedAt: "2026-09-09T04:00:20.000Z",
      }).currentStepIndex,
    ).toBe(1);
  });

  it("moves through baseline, ordered tasks, post rating and follow-up", () => {
    const started = acceptBaseline(assignedSession(), {
      expectedVersion: 1,
      value: 3,
      observedAt: "2026-08-27T04:00:00.000Z",
    });
    expect(started).toMatchObject({ status: "in_progress", baseline: 3, version: 2 });

    const afterMath = acceptTaskResult(started, {
      expectedVersion: 2,
      stepIndex: 0,
      taskId: "math",
      correct: 2,
      total: 3,
      durationMs: 40_000,
      difficultyLevel: 2,
      observedAt: "2026-08-27T04:00:40.000Z",
    });
    expect(afterMath.tasks[0]).toMatchObject({ correct: 2, total: 3, difficultyLevel: 2 });
    const afterMemory = acceptTaskResult(afterMath, {
      expectedVersion: 3,
      stepIndex: 1,
      taskId: "memory",
      correct: 1,
      total: 1,
      durationMs: 20_000,
      observedAt: "2026-08-27T04:01:00.000Z",
    });
    expect(afterMemory.currentStepIndex).toBe(2);

    const completed = acceptPostRating(afterMemory, {
      expectedVersion: 4,
      value: 7,
      observedAt: "2026-08-27T04:01:10.000Z",
      followUpDelayMinutes: 15,
    });
    expect(completed).toMatchObject({
      status: "protocol_completed",
      postRating: 7,
      version: 5,
      followUpDueAt: "2026-08-27T04:16:10.000Z",
    });

    const followedUp = acceptFollowUp(completed, {
      expectedVersion: 5,
      outcome: "up",
    });
    expect(followedUp).toMatchObject({ followUp: "up", version: 6 });
  });

  it("rejects stale commands and out-of-order tasks without mutating the session", () => {
    const session = acceptBaseline(assignedSession(), {
      expectedVersion: 1,
      value: 2,
      observedAt: "2026-08-27T04:00:00.000Z",
    });

    expect(() =>
      acceptTaskResult(session, {
        expectedVersion: 1,
        stepIndex: 0,
        taskId: "math",
        correct: 1,
        total: 1,
        durationMs: 1000,
        observedAt: "2026-08-27T04:00:01.000Z",
      }),
    ).toThrowError(/stale/i);

    expect(() =>
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 1,
        taskId: "memory",
        correct: 1,
        total: 1,
        durationMs: 1000,
        observedAt: "2026-08-27T04:00:01.000Z",
      }),
    ).toThrowError(/step/i);
    expect(session.tasks).toHaveLength(0);
  });

  it("rejects a task difficulty outside the supported range", () => {
    const session = acceptBaseline(assignedSession(), {
      expectedVersion: 1,
      value: 2,
      observedAt: "2026-08-27T04:00:00.000Z",
    });

    expect(() =>
      acceptTaskResult(session, {
        expectedVersion: 2,
        stepIndex: 0,
        taskId: "math",
        correct: 1,
        total: 1,
        durationMs: 1000,
        difficultyLevel: 4,
        observedAt: "2026-08-27T04:00:01.000Z",
      }),
    ).toThrowError(/task result values/i);
  });

  it("does not complete before every assigned step and can abandon an unfinished session", () => {
    const session = acceptBaseline(assignedSession(), {
      expectedVersion: 1,
      value: 4,
      observedAt: "2026-08-27T04:00:00.000Z",
    });

    expect(() =>
      acceptPostRating(session, {
        expectedVersion: 2,
        value: 6,
        observedAt: "2026-08-27T04:00:10.000Z",
        followUpDelayMinutes: 15,
      }),
    ).toThrowError(/steps/i);

    const abandoned = abandonSession(session, {
      expectedVersion: 2,
      observedAt: "2026-08-27T04:00:20.000Z",
    });
    expect(abandoned).toMatchObject({ status: "abandoned", version: 3 });
  });

  it("accepts the single chain follow-up after an abandoned recovery", () => {
    const recovery = {
      ...assignedSession(),
      sessionKind: "recovery" as const,
      status: "abandoned" as const,
      baseline: 4,
      version: 3,
      abandonedAt: "2026-08-27T04:00:20.000Z",
    };

    expect(acceptFollowUp(recovery, { expectedVersion: 3, outcome: "drowsy" })).toMatchObject({
      followUp: "drowsy",
      version: 4,
    });
  });
});
