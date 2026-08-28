import { useEffect, useState } from "react";

import {
  loadAnalyticsProfile,
  type AnalyticsProfileResponse,
} from "../../shared/api/client.js";

export type AnalyticsState =
  | { status: "idle" | "loading" }
  | { status: "ready"; profile: AnalyticsProfileResponse }
  | { status: "error"; message: string };

export function useAnalyticsProfile(enabled: boolean): AnalyticsState {
  const [state, setState] = useState<AnalyticsState>({ status: "idle" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading" });
    void loadAnalyticsProfile()
      .then((profile) => {
        if (!cancelled) setState({ status: "ready", profile });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить аналитику",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
