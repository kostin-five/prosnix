import { useEffect, useState } from "react";
import { Flag, LockKeyhole } from "lucide-react";

import {
  MORNING_GOAL_MAX_LENGTH,
  readMorningGoal,
  saveMorningGoal,
} from "./morning-preferences.js";
import { loadLifeGoal, saveLifeGoal } from "./personalization-api.js";

export function MorningGoalCard({ storageScope }: { storageScope: string }) {
  const [goal, setGoal] = useState(() => readMorningGoal(storageScope));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const demo = storageScope === "demo";

  useEffect(() => {
    const local = readMorningGoal(storageScope);
    if (demo) {
      setGoal(local);
      setDraft(local);
      return;
    }
    let active = true;
    void loadLifeGoal()
      .then((saved) => {
        if (!active) return;
        setGoal(saved.text);
        setDraft(saved.text || local);
        setRevision(saved.revision);
        setError("");
      })
      .catch(() => {
        if (active) setError("Не удалось загрузить цель. Повтори позже.");
      });
    return () => {
      active = false;
    };
  }, [demo, storageScope]);

  const save = async (value: string) => {
    setSaving(true);
    setError("");
    try {
      const normalized = value.replace(/\s+/g, " ").trim();
      const saved = demo
        ? { text: saveMorningGoal(storageScope, normalized), revision }
        : await saveLifeGoal(normalized, revision);
      if (!demo) saveMorningGoal(storageScope, "");
      setGoal(saved.text);
      setDraft(saved.text);
      setRevision(saved.revision);
      setEditing(false);
    } catch {
      setError("Не удалось сохранить цель. Повтори позже.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ps-surface mb-4 p-4">
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Твоя цель в жизни</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Что вдохновляет тебя начать новый день? Цель появится перед протоколом и в личном утреннем
        сообщении бота.
      </p>
      {!demo && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          После сохранения цель хранится на сервере и отправляется в твой личный чат Telegram. Не
          указывай то, чем не хочешь делиться в сообщении.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {!editing ? (
        <div className="mt-3 rounded-2xl bg-secondary/60 p-3">
          <p className={goal ? "text-sm leading-relaxed" : "text-xs text-muted-foreground"}>
            {goal || "Цель не указана — это необязательно."}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 min-h-10 rounded-xl border border-border px-3 text-xs font-semibold"
          >
            {goal ? "Изменить цель" : "Добавить цель"}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <label htmlFor="morning-goal" className="text-xs font-semibold text-muted-foreground">
            Моя жизненная цель
          </label>
          <input
            id="morning-goal"
            type="text"
            value={draft}
            maxLength={MORNING_GOAL_MAX_LENGTH}
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            placeholder="Например: построить своё дело"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void save(draft);
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-secondary px-3 text-sm outline-none focus:border-primary"
          />
          <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <LockKeyhole className="h-3 w-3" aria-hidden="true" />{" "}
              {demo ? "Только на этом устройстве" : "Личный чат Telegram"}
            </span>
            <span>
              {draft.length}/{MORNING_GOAL_MAX_LENGTH}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void save(draft)}
              disabled={saving}
              className="ps-primary-button min-h-11 px-3 text-sm"
            >
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={() => void save("")}
              disabled={saving}
              className="min-h-11 rounded-xl bg-secondary px-3 text-sm font-semibold"
            >
              {goal ? "Удалить цель" : "Не указывать"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function MorningGoalBanner({ goal }: { goal: string }) {
  if (!goal) return null;
  return (
    <div className="mb-6 rounded-2xl border border-primary/25 bg-primary/8 p-4 text-left">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Ради чего ты начинаешь день
      </p>
      <p className="mt-2 text-sm leading-relaxed">{goal}</p>
      <p className="mt-2 text-xs text-muted-foreground">Сейчас — только оцени бодрость.</p>
    </div>
  );
}

export default MorningGoalCard;
