import { useEffect, useState } from "react";

import { loadCoachInsight, type CoachInsightResponse } from "../../shared/api/client.js";

type CoachState =
  | { status: "idle" | "loading" }
  | { status: "ready"; insight: CoachInsightResponse }
  | { status: "error"; message: string };

export function useCoachInsight(enabled: boolean): CoachState {
  const [state, setState] = useState<CoachState>({ status: enabled ? "loading" : "idle" });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ status: "loading" });
    void loadCoachInsight()
      .then((insight) => active && setState({ status: "ready", insight }))
      .catch(
        (error: unknown) =>
          active &&
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "AI-наставник временно недоступен",
          }),
      );
    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}
