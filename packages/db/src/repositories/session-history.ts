import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { SessionHistoryItem, SessionHistoryRepository, TaskId } from "@awc/domain";
import {
  followUpObservations,
  ratingObservations,
  taskObservations,
  wakeSessions,
} from "../schema.js";
import type { Database } from "./types.js";

const TASK_IDS = new Set<string>([
  "math",
  "memory",
  "stroop",
  "reaction",
  "steps",
  "squats",
  "shake",
  "water",
  "window",
  "curtains",
  "sit_edge",
  "cool_wash",
  "pushups",
  "notice_three",
  "find_color",
  "breathing",
]);

function isTaskId(value: string): value is TaskId {
  return TASK_IDS.has(value);
}

export class PostgresSessionHistoryRepository implements SessionHistoryRepository {
  constructor(private readonly db: Database) {}

  async listCompleted(userId: string, limit: number): Promise<SessionHistoryItem[]> {
    const sessions = await this.db
      .select({
        id: wakeSessions.id,
        startedAt: wakeSessions.startedAt,
        completedAt: wakeSessions.protocolCompletedAt,
        wakeContext: wakeSessions.wakeContext,
        durationMinutes: wakeSessions.durationBudgetMinutes,
        sessionKind: wakeSessions.sessionKind,
        parentSessionId: wakeSessions.parentSessionId,
      })
      .from(wakeSessions)
      .where(and(eq(wakeSessions.userId, userId), eq(wakeSessions.status, "protocol_completed")))
      .orderBy(desc(wakeSessions.protocolCompletedAt))
      .limit(Math.max(1, Math.min(20, limit)));
    const completed = sessions.filter(
      (session): session is typeof session & { completedAt: Date } => session.completedAt !== null,
    );
    if (completed.length === 0) return [];
    const ids = completed.map(({ id }) => id);
    const ratingSessionIds = [
      ...new Set([...ids, ...completed.flatMap(({ parentSessionId }) => parentSessionId ?? [])]),
    ];
    const [ratings, tasks, followUps] = await Promise.all([
      this.db
        .select()
        .from(ratingObservations)
        .where(inArray(ratingObservations.sessionId, ratingSessionIds)),
      this.db
        .select()
        .from(taskObservations)
        .where(inArray(taskObservations.sessionId, ids))
        .orderBy(asc(taskObservations.protocolStepIndex)),
      this.db
        .select()
        .from(followUpObservations)
        .where(inArray(followUpObservations.sessionId, ids)),
    ]);
    return completed.flatMap((session) => {
      const baseline = ratings.find(
        (rating) =>
          rating.sessionId ===
            (session.sessionKind === "recovery" ? session.parentSessionId : session.id) &&
          rating.kind === (session.sessionKind === "recovery" ? "post_protocol" : "baseline"),
      )?.value;
      const postRating = ratings.find(
        (rating) => rating.sessionId === session.id && rating.kind === "post_protocol",
      )?.value;
      if (baseline === undefined || postRating === undefined) return [];
      return [
        {
          id: session.id,
          completedAt: session.completedAt,
          baseline,
          postRating,
          durationMs: session.startedAt
            ? Math.max(0, session.completedAt.getTime() - session.startedAt.getTime())
            : null,
          followUp:
            followUps.find((followUp) => followUp.sessionId === session.id)?.outcome ?? null,
          tasks: tasks
            .filter((task) => task.sessionId === session.id)
            .filter((task): task is typeof task & { taskId: TaskId } => isTaskId(task.taskId))
            .map((task) => ({ taskId: task.taskId, category: task.category })),
          wakeContext: session.wakeContext,
          durationMinutes: session.durationMinutes as 2 | 5 | 10,
          sessionKind: session.sessionKind,
          parentSessionId: session.parentSessionId,
        },
      ];
    });
  }
}
