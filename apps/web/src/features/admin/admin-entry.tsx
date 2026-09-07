import { useCallback, useEffect, useState } from "react";

import { authenticateTelegram } from "../../shared/api/client.js";
import { getLaunchContext } from "../../telegram/bridge.js";
import { AdminScreen } from "./admin-screen.js";

type EntryState =
  { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

export function AdminEntry() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<EntryState>({ status: "loading" });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      try {
        const launch = getLaunchContext();
        if (launch.mode === "telegram") await authenticateTelegram(launch.initData);
        if (!cancelled) setState({ status: "ready" });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Не удалось подтвердить Telegram-вход",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === "ready") return <AdminScreen />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <section className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center">
        {state.status === "loading" ? (
          <p className="text-sm text-muted-foreground">Подтверждаем защищённый вход…</p>
        ) : (
          <>
            <h1 className="text-xl font-bold">Откройте панель через Telegram</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.message}</p>
            <a
              className="mt-5 block rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
              href="https://t.me/prosnix_bot?startapp=admin"
            >
              Открыть в Prosnix
            </a>
            <button
              type="button"
              onClick={retry}
              className="mt-3 min-h-11 w-full rounded-xl bg-secondary px-4 text-sm font-semibold"
            >
              Повторить
            </button>
          </>
        )}
      </section>
    </main>
  );
}

export default AdminEntry;
