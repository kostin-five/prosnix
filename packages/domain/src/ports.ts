import type {
  FollowUpOutcome,
  SessionStatus,
  TaskId,
  WakeSession,
} from "./model.js";

export interface UserRecord {
  id: string;
  telegramUserId: bigint;
  locale: string | null;
  timezone: string;
  deletionRequestedAt: Date | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  assignmentId: string;
  status: SessionStatus;
  currentStepIndex: number;
  version: number;
  startedAt: Date | null;
  protocolCompletedAt: Date | null;
  followUpDueAt: Date | null;
  abandonedAt: Date | null;
}

export interface StoredCommandResult {
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
}

export interface UserRepository {
  findByTelegramId(telegramUserId: bigint): Promise<UserRecord | null>;
  createFromTelegram(input: {
    telegramUserId: bigint;
    locale?: string;
  }): Promise<UserRecord>;
}

export interface SessionRepository {
  findActiveForUser(userId: string): Promise<SessionRecord | null>;
  findOwnedById(userId: string, sessionId: string): Promise<SessionRecord | null>;
  updateState(input: {
    userId: string;
    sessionId: string;
    expectedVersion: number;
    status: SessionStatus;
    currentStepIndex: number;
    startedAt?: Date | null;
    protocolCompletedAt?: Date | null;
    followUpDueAt?: Date | null;
    abandonedAt?: Date | null;
  }): Promise<SessionRecord | null>;
}

export interface IdempotencyRepository {
  find(userId: string, operationId: string): Promise<StoredCommandResult | null>;
  save(input: {
    userId: string;
    operationId: string;
    commandType: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
    expiresAt: Date;
  }): Promise<void>;
}

export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  idempotency: IdempotencyRepository;
}

export interface BootstrapSession {
  session: SessionRecord;
  protocol: {
    key: string;
    version: number;
    title: string;
    steps: unknown;
  };
  assignment: {
    strategyVersion: string;
    phase: "learning" | "adaptive" | "fallback";
    hypothesis: string;
  };
  baseline: number | null;
  postRating: number | null;
}

export interface BootstrapSnapshot {
  user: UserRecord;
  activeSession: BootstrapSession | null;
  dueFollowUpSessionId: string | null;
}

export interface BootstrapRepository {
  load(userId: string, now?: Date): Promise<BootstrapSnapshot | null>;
}

export interface UnitOfWork {
  transaction<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

export type SessionCommand =
  | { type: "create"; timezone: string }
  | {
      type: "baseline";
      sessionId: string;
      expectedVersion: number;
      value: number;
      clientObservedAt?: string;
    }
  | {
      type: "task";
      sessionId: string;
      expectedVersion: number;
      stepIndex: number;
      taskId: TaskId;
      correct: number;
      total: number;
      durationMs: number;
    }
  | {
      type: "post_rating";
      sessionId: string;
      expectedVersion: number;
      value: number;
      clientObservedAt?: string;
    }
  | {
      type: "follow_up";
      sessionId: string;
      expectedVersion?: number;
      outcome: FollowUpOutcome;
    }
  | {
      type: "abandon";
      sessionId: string;
      expectedVersion: number;
    };

export interface SessionCommandEnvelope {
  userId: string;
  operationId: string;
  requestHash: string;
  observedAt: Date;
  command: SessionCommand;
}

export interface SessionCommandResult {
  session: WakeSession;
  responseStatus: 200 | 201;
  replayed: boolean;
}

export class SessionCommandConflict extends Error {
  constructor(
    readonly code:
      | "idempotency_conflict"
      | "stale_version"
      | "invalid_transition"
      | "session_not_found",
    message: string,
    readonly canonicalSession: WakeSession | null,
  ) {
    super(message);
    this.name = "SessionCommandConflict";
  }
}

export interface SessionCommandRepository {
  execute(envelope: SessionCommandEnvelope): Promise<SessionCommandResult>;
}
