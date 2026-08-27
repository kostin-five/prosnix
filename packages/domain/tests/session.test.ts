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
      observedAt: "2026-08-27T04:00:40.000Z",
    });
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
});
