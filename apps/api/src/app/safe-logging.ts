import type { FastifyRequest } from "fastify";
// Never serialize free-form errors: ORM messages can contain SQL parameters.
export function safeError(error: unknown): { type: string; message: string; stack: string } {
  return {
    type: error instanceof Error ? "Error" : "UnknownError",
    message: "redacted",
    stack: "",
  };
}

export function safeRequest(request: FastifyRequest) {
  return { method: request.method ?? "UNKNOWN", url: request.routeOptions?.url ?? "[unmatched]" };
}

export const privacyLoggerOptions = {
  serializers: {
    req: safeRequest,
    err: safeError,
    res: (response: { statusCode?: number }) => ({ statusCode: response.statusCode ?? 0 }),
  },
  redact: {
    paths: ["req.headers", "req.body", "req.query", "req.params", "res.headers"],
    remove: true,
  },
};
