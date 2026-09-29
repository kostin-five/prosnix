import React from "react";
import { Check } from "lucide-react";
import type { WakeRoutine, WakeRoutineRun } from "../../shared/api/client.js";
import { TaskIcon } from "../tasks/task-icon.js";
import { loadWakeRoutineRun, saveWakeRoutineRun } from "./personalization-api.js";

export function WakeRoutineCard({
  routine,
  saving,
  onSave,
}: {
  routine: WakeRoutine;
  saving: boolean;
  onSave: (routine: Omit<WakeRoutine, "revision">) => Promise<void>;
}) {
  const [items, setItems] = React.useState(routine.items);
  const [enabled, setEnabled] = React.useState(routine.enabled);
  const [expanded, setExpanded] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  React.useEffect(() => {
    setItems(routine.items);
    setEnabled(routine.enabled);
  }, [routine]);
  const add = () =>
    items.length < 5 && setItems([...items, { id: crypto.randomUUID(), title: "" }]);
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
  };
  const submit = async () => {
    setFeedback(null);
    try {
      await onSave({
        enabled,
        items: items.map((item) => ({ ...item, title: item.title.trim() })),
      });
      setFeedback("Рутина сохранена");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Не удалось сохранить рутину");
    }
  };
  return (
    <section className="ps-surface mb-4 p-4">
      <div className="flex items-center gap-2">
        <TaskIcon taskId="window" className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Рутина после пробуждения</h2>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="ml-auto min-h-11 rounded-xl px-2 text-xs font-semibold text-accent"
        >
          {expanded ? "Свернуть" : "Развернуть"}
        </button>
      </div>
      {!expanded ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {enabled && items.length
            ? `${items.length} пунктов · покажем после измерения`
            : "Не настроена · можно добавить позже"}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Необязательный чек-лист после измерения. На аналитику не влияет.
          </p>
          <label className="mt-4 flex min-h-11 items-center justify-between rounded-xl bg-secondary px-3 text-sm">
            <span>Показывать рутину</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
          </label>
          <div className="mt-3 space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-2"
              >
                <input
                  aria-label={`Пункт рутины ${index + 1}`}
                  value={item.title}
                  maxLength={80}
                  onChange={(event) =>
                    setItems(
                      items.map((current) =>
                        current.id === item.id
                          ? { ...current, title: event.target.value }
                          : current,
                      ),
                    )
                  }
                  placeholder="Например, выпить воды"
                  className="min-h-12 w-full rounded-xl border border-border bg-secondary px-4 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    aria-label={`Поднять пункт ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="min-h-10 min-w-10 rounded-xl border border-border disabled:opacity-30"
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Опустить пункт ${index + 1}`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                    className="min-h-10 min-w-10 rounded-xl border border-border disabled:opacity-30"
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Удалить пункт"
                    onClick={() => setItems(items.filter((current) => current.id !== item.id))}
                    className="min-h-10 min-w-10 rounded-xl border border-border"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
          {items.length < 5 && (
            <button
              onClick={add}
              className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
            >
              <span aria-hidden="true">+</span> Добавить пункт
            </button>
          )}
          <button
            disabled={saving || items.some((item) => !item.title.trim())}
            onClick={() => void submit()}
            className="ps-primary-button mt-3 w-full disabled:opacity-50"
          >
            {saving ? "Сохраняем…" : "Сохранить рутину"}
          </button>
          {feedback && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              {feedback}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function WakeRoutineChecklist({
  sessionId,
  routine,
  demo,
}: {
  sessionId: string;
  routine: WakeRoutine;
  demo: boolean;
}) {
  const [run, setRun] = React.useState<WakeRoutineRun>({
    sessionId,
    items: routine.items,
    completedItemIds: [],
    revision: 0,
    completedAt: null,
  });
  const [loading, setLoading] = React.useState(!demo);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    setRun({
      sessionId,
      items: routine.items,
      completedItemIds: [],
      revision: 0,
      completedAt: null,
    });
    if (demo) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    void loadWakeRoutineRun(sessionId)
      .then((stored) => {
        if (active && stored) setRun(stored);
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Не удалось восстановить рутину");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demo, routine.items, sessionId]);
  if (!routine.enabled || routine.items.length === 0) return null;
  const toggle = async (id: string) => {
    if (saving) return;
    const completed = run.completedItemIds.includes(id)
      ? run.completedItemIds.filter((item) => item !== id)
      : [...run.completedItemIds, id];
    if (demo) {
      setRun({ ...run, completedItemIds: completed, revision: run.revision + 1 });
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setRun(await saveWakeRoutineRun(sessionId, completed, run.revision));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить рутину");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mb-5 rounded-2xl border border-accent/25 bg-accent/5 p-4">
      <p className="text-sm font-semibold">Продолжить после пробуждения</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Личная рутина хранится отдельно и не меняет результат эксперимента.
      </p>
      {loading ? (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          Восстанавливаем чек-лист…
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {run.items.map((item) => (
            <button
              key={item.id}
              disabled={saving}
              onClick={() => void toggle(item.id)}
              aria-pressed={run.completedItemIds.includes(item.id)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-secondary px-3 text-left text-sm"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded border ${run.completedItemIds.includes(item.id) ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}
              >
                {run.completedItemIds.includes(item.id) && <Check className="h-3.5 w-3.5" />}
              </span>
              {item.title}
            </button>
          ))}
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
