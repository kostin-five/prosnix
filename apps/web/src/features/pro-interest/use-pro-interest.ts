import { useEffect, useState } from "react";

import {
  loadProInterestStatus,
  submitProInterest,
  type ProInterestStatus,
} from "./pro-interest-api.js";

export type ProInterestState =
  | { status: "idle" | "loading" }
  | { status: "ready"; interest: ProInterestStatus }
  | { status: "error"; message: string };

export function useProInterest(enabled: boolean, refreshKey: number) {
  const [state, setState] = useState<ProInterestState>({ status: "idle" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading" });
    void loadProInterestStatus()
      .then((interest) => {
        if (!cancelled) setState({ status: "ready", interest });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Не удалось загрузить вопрос",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  async function submit(input: {
    intent: "interested" | "not_now" | "not_interested";
    interestFocus?: "long_history" | "deeper_experiments" | "both";
  }) {
    const interest = await submitProInterest(input);
    setState({ status: "ready", interest });
  }

  return { state, submit };
}
