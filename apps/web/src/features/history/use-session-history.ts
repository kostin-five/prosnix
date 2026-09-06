import { useEffect, useState } from "react";

import { loadSessionHistory, type SessionHistoryItemResponse } from "../../shared/api/client.js";

type HistoryState =
  | { status: "idle" | "loading"; items: SessionHistoryItemResponse[] }
  | { status: "ready"; items: SessionHistoryItemResponse[] }
  | { status: "error"; items: SessionHistoryItemResponse[]; message: string };

export function useSessionHistory(enabled: boolean, refreshKey = 0): HistoryState {
  const [state, setState] = useState<HistoryState>({
    status: enabled ? "loading" : "idle",
    items: [],
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ status: "loading", items: [] });
    void loadSessionHistory()
      .then(({ sessions }) => active && setState({ status: "ready", items: sessions }))
      .catch(
        (error: unknown) =>
          active &&
          setState({
            status: "error",
            items: [],
            message: error instanceof Error ? error.message : "Не удалось загрузить историю",
          }),
      );
    return () => {
      active = false;
    };
  }, [enabled, refreshKey]);

  return state;
}
