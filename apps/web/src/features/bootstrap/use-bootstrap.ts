import { useCallback, useEffect, useState } from "react";

import {
  authenticateTelegram,
  loadLegalStatus,
  loadBootstrap,
  type BootstrapResponse,
} from "../../shared/api/client.js";
import { getLaunchContext } from "../../telegram/bridge.js";

export const BOOTSTRAP_TIMEOUT_MS = 20_000;

export type BootstrapState =
  | { status: "loading" }
  | { status: "error"; reason: "timeout" | "request"; message: string }
  | { status: "ready"; mode: "demo"; data: null }
  | {
      status: "ready";
      mode: "telegram";
      data: BootstrapResponse;
      legal: Awaited<ReturnType<typeof loadLegalStatus>>;
    };

export function useBootstrap(): BootstrapState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BootstrapState>({ status: "loading" });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS);
    setState({ status: "loading" });
    void (async () => {
      try {
        const launch = getLaunchContext();
        if (launch.mode === "demo") {
          if (!cancelled) setState({ status: "ready", mode: "demo", data: null });
          return;
        }
        await authenticateTelegram(launch.initData, controller.signal);
        const [data, legal] = await Promise.all([
          loadBootstrap(controller.signal),
          loadLegalStatus(controller.signal),
        ]);
        if (!cancelled) setState({ status: "ready", mode: "telegram", data, legal });
      } catch (error) {
        if (!cancelled) {
          const timedOut = controller.signal.aborted;
          setState({
            status: "error",
            reason: timedOut ? "timeout" : "request",
            message: timedOut
              ? "Сервер запускается дольше обычного. Подожди немного и попробуй ещё раз."
              : error instanceof Error
                ? error.message
                : "Не удалось открыть приложение",
          });
        }
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return { ...state, retry };
}
