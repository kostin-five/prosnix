import { useEffect, useState } from "react";
import { Flag, LockKeyhole } from "lucide-react";

import {
  MORNING_GOAL_MAX_LENGTH,
  readMorningGoal,
  saveMorningGoal,
} from "./morning-preferences.js";

export function MorningGoalCard({ storageScope }: { storageScope: string }) {
  const [goal, setGoal] = useState(() => readMorningGoal(storageScope));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal);

  useEffect(() => {
    const saved = readMorningGoal(storageScope);
    setGoal(saved);
    setDraft(saved);
  }, [storageScope]);

  const save = () => {
    const saved = saveMorningGoal(storageScope, draft);
    setGoal(saved);
    setDraft(saved);
    setEditing(false);
  };

  return (
    <section className="mb-4 rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Зачем тебе вставать?</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Короткая личная фраза появится перед утренним протоколом.
      </p>

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
            Моя причина встать утром
          </label>
          <input
            id="morning-goal"
            type="text"
            value={draft}
            maxLength={MORNING_GOAL_MAX_LENGTH}
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            placeholder="Например: спокойно начать день и закончить проект"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              save();
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-secondary px-3 text-sm outline-none focus:border-primary"
          />
          <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <LockKeyhole className="h-3 w-3" aria-hidden="true" /> Только на этом устройстве
            </span>
            <span>
              {draft.length}/{MORNING_GOAL_MAX_LENGTH}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={save}
              className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setGoal(saveMorningGoal(storageScope, ""));
                setEditing(false);
              }}
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
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Твоя причина встать
      </p>
      <p className="mt-2 text-sm leading-relaxed">{goal}</p>
      <p className="mt-2 text-xs text-muted-foreground">Сейчас — только оцени бодрость.</p>
    </div>
  );
}

export default MorningGoalCard;
