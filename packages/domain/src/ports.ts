import type { SessionStatus } from "./model.js";

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

export interface UnitOfWork {
  transaction<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
