import { useCallback, useState } from "react";

import { loadCoachInsight, type CoachInsightResponse } from "../../shared/api/client.js";

export type CoachState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; insight: CoachInsightResponse }
  | { status: "error"; message: string };

export function useCoachInsight(enabled: boolean): {
  state: CoachState;
  requestInsight: (confirmEarly?: boolean) => Promise<void>;
  resetInsight: () => void;
} {
  const [state, setState] = useState<CoachState>({ status: "idle" });

  const requestInsight = useCallback(
    async (confirmEarly = false) => {
      if (!enabled || state.status === "loading") return;
      setState({ status: "loading" });
      try {
        setState({ status: "ready", insight: await loadCoachInsight(confirmEarly) });
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "AI-разбор временно недоступен",
        });
      }
    },
    [enabled, state.status],
  );

  const resetInsight = useCallback(() => setState({ status: "idle" }), []);

  return { state, requestInsight, resetInsight };
}
