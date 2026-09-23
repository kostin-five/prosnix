import React from "react";
import { Home, X } from "lucide-react";

import {
  addTelegramToHomeScreen,
  checkTelegramHomeScreenStatus,
  type TelegramHomeScreenStatus,
} from "../../telegram/bridge.js";

const STORAGE_KEY = "prosnix.home-screen-prompt.handled.v1";

export function HomeScreenPrompt({ firstCompletion }: { firstCompletion: boolean }) {
  const [handled, setHandled] = React.useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [status, setStatus] = React.useState<TelegramHomeScreenStatus | "checking">("checking");

  React.useEffect(() => {
    if (!firstCompletion || handled) return;
    let active = true;
    void checkTelegramHomeScreenStatus().then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });
    return () => {
      active = false;
    };
  }, [firstCompletion, handled]);

  if (!firstCompletion || handled || status === "added") return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Local storage is optional in restricted WebViews.
    }
    setHandled(true);
  };

  const add = () => {
    if (!addTelegramToHomeScreen()) return;
    dismiss();
  };

  return (
    <section className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Home className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Открывай Prosnix быстрее утром</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {status === "unsupported"
              ? "Если Telegram показывает пункт «Добавить на главный экран» в меню Mini App, выбери его — ярлык откроет приложение без поиска бота."
              : "Добавь Mini App на главный экран, чтобы запускать пробуждение одним нажатием."}
          </p>
        </div>
        <button
          type="button"
          aria-label="Больше не показывать"
          onClick={dismiss}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {status !== "unsupported" && status !== "checking" && (
        <button
          type="button"
          onClick={add}
          className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Добавить на главный экран
        </button>
      )}
      {status === "checking" && (
        <p className="mt-3 text-xs text-muted-foreground">Проверяем поддержку Telegram…</p>
      )}
    </section>
  );
}
