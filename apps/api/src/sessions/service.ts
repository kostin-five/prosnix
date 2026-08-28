import { createHash } from "node:crypto";

import type {
  SessionCommand,
  SessionCommandRepository,
  SessionCommandResult,
} from "@awc/domain";

function commandHash(command: SessionCommand): string {
  return createHash("sha256").update(JSON.stringify(command)).digest("hex");
}

export class SessionService {
  constructor(
    private readonly repository: SessionCommandRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(
    userId: string,
    operationId: string,
    command: SessionCommand,
  ): Promise<SessionCommandResult> {
    return this.repository.execute({
      userId,
      operationId,
      requestHash: commandHash(command),
      observedAt: this.now(),
      command,
    });
  }
}
