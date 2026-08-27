import { useCallback, useEffect, useState } from "react";

import {
  authenticateTelegram,
  loadBootstrap,
  type BootstrapResponse,
} from "../../shared/api/client.js";
import { getLaunchContext } from "../../telegram/bridge.js";

export type BootstrapState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; mode: "demo"; data: null }
  | { status: "ready"; mode: "telegram"; data: BootstrapResponse };

export function useBootstrap(): BootstrapState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BootstrapState>({ status: "loading" });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      try {
        const launch = getLaunchContext();
        if (launch.mode === "demo") {
          if (!cancelled) setState({ status: "ready", mode: "demo", data: null });
          return;
        }
        await authenticateTelegram(launch.initData);
        const data = await loadBootstrap();
        if (!cancelled) setState({ status: "ready", mode: "telegram", data });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Не удалось открыть приложение",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...state, retry };
}
