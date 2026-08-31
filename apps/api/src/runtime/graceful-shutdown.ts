export type ShutdownSignal = "SIGINT" | "SIGTERM";
export type ShutdownResult = "closed" | "deadline_exceeded" | "close_failed";

export function createGracefulShutdown(options: {
  close: () => Promise<void>;
  deadlineMs: number;
  onDeadline: () => void;
  onError?: (error: unknown) => void;
}): (signal: ShutdownSignal) => Promise<ShutdownResult> {
  let inFlight: Promise<ShutdownResult> | null = null;

  return (_signal) => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<ShutdownResult>((resolve) => {
        timer = setTimeout(() => resolve("deadline_exceeded"), options.deadlineMs);
        timer.unref?.();
      });
      try {
        const result = await Promise.race([
          options.close().then(() => "closed" as const),
          deadline,
        ]);
        if (timer) clearTimeout(timer);
        if (result === "deadline_exceeded") options.onDeadline();
        return result;
      } catch (error) {
        if (timer) clearTimeout(timer);
        options.onError?.(error);
        options.onDeadline();
        return "close_failed";
      }
    })();
    return inFlight;
  };
}
