import { useState } from "react";

import { deleteProfile } from "../../shared/api/client.js";
import { clearMorningPreferences } from "../personalization/morning-preferences.js";
import { clearSessionDrafts } from "../session/draft-store.js";

export function DeleteProfile({ localStorageScope }: { localStorageScope: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteProfile();
      await clearSessionDrafts();
      clearMorningPreferences(localStorageScope);
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить профиль");
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-red-500/20 bg-card p-4">
      <p className="text-sm font-semibold">Управление данными</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Профиль, сессии и аналитика будут удалены без возможности восстановления.
      </p>
      {!confirming ? (
        <button className="mt-3 text-sm text-red-400" onClick={() => setConfirming(true)}>
          Удалить мой профиль
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-profile-title"
          className="mt-3 flex flex-col gap-2"
        >
          <p id="delete-profile-title" className="text-xs text-red-300">
            Точно удалить все данные?
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="flex-1 rounded-xl bg-red-500 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => void remove()}
            >
              {busy ? "Удаляем…" : "Да, удалить всё"}
            </button>
            <button
              disabled={busy}
              className="flex-1 rounded-xl bg-secondary px-3 py-2 text-sm"
              onClick={() => setConfirming(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
