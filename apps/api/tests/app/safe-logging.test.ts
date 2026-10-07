import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { privacyLoggerOptions } from "../../src/app/safe-logging.js";

describe("privacy-safe request logging", () => {
  it("does not log query, identity, body, ORM parameters or error causes", async () => {
    const sentinel = "private-fixture-value";
    const lines: string[] = [];
    const app = Fastify({
      logger: {
        ...privacyLoggerOptions,
        stream: {
          write(line: string) {
            lines.push(line);
          },
        },
      },
    });
    app.post("/probe/:id", async (request, reply) => {
      request.log.error(
        { err: new Error(`SQL params: ${sentinel}`, { cause: new Error(sentinel) }) },
        "request failed",
      );
      return reply.status(500).send({ error: "internal_error" });
    });
    try {
      await app.inject({
        method: "POST",
        url: `/probe/${sentinel}?answer=${sentinel}`,
        headers: { authorization: sentinel, cookie: sentinel },
        payload: { answer: sentinel },
      });
      const logs = lines.join("");
      expect(logs).not.toContain(sentinel);
      expect(logs).not.toContain("SQL params");
      expect(logs).toContain("request failed");
      expect(logs).toContain('"statusCode":500');
    } finally {
      await app.close();
    }
  });
});
