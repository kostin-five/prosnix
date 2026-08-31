import { describe, expect, it, vi } from "vitest";

import { createGracefulShutdown } from "../../src/runtime/graceful-shutdown.js";

describe("graceful shutdown", () => {
  it("closes resources once when multiple signals arrive", async () => {
    const close = vi.fn(async () => undefined);
    const onDeadline = vi.fn();
    const shutdown = createGracefulShutdown({ close, deadlineMs: 1_000, onDeadline });

    const first = shutdown("SIGTERM");
    const second = shutdown("SIGINT");
    await Promise.all([first, second]);

    expect(close).toHaveBeenCalledOnce();
    expect(onDeadline).not.toHaveBeenCalled();
  });

  it("invokes the forced termination boundary when closing exceeds its deadline", async () => {
    vi.useFakeTimers();
    try {
      const onDeadline = vi.fn();
      const shutdown = createGracefulShutdown({
        close: () => new Promise<void>(() => undefined),
        deadlineMs: 100,
        onDeadline,
      });

      const result = shutdown("SIGTERM");
      await vi.advanceTimersByTimeAsync(100);

      await expect(result).resolves.toBe("deadline_exceeded");
      expect(onDeadline).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
