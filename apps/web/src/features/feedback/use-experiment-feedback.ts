import { useEffect, useState } from "react";

import {
  loadExperimentFeedbackStatus,
  submitExperimentFeedback,
  type ExperimentFeedbackStatus,
} from "../../shared/api/client.js";

export type FeedbackState =
  | { status: "idle" | "loading" }
  | { status: "ready"; feedback: ExperimentFeedbackStatus }
  | { status: "error"; message: string };

export function useExperimentFeedback(enabled: boolean, refreshKey: number) {
  const [state, setState] = useState<FeedbackState>({ status: "idle" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading" });
    void loadExperimentFeedbackStatus()
      .then((feedback) => {
        if (!cancelled) setState({ status: "ready", feedback });
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

  async function submit(input: { helpful: number; irritating: number; continueIntent: number }) {
    const feedback = await submitExperimentFeedback(input);
    setState({ status: "ready", feedback });
  }

  return { state, submit };
}
