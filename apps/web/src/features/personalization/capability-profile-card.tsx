import React from "react";
import { Check } from "lucide-react";
import type { WakeProfile } from "../../shared/api/client.js";

export function CapabilityProfileCard({
  profile,
  saving,
  onSave,
}: {
  profile: WakeProfile;
  saving: boolean;
  onSave: (profile: Omit<WakeProfile, "revision">) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(profile);
  const [editing, setEditing] = React.useState(!profile.onboardingCompleted);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  React.useEffect(() => setDraft(profile), [profile]);
  const submit = async () => {
    setFeedback(null);
    try {
      await onSave({ ...draft, onboardingCompleted: true });
      setFeedback("Возможности сохранены");
      setEditing(false);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Не удалось сохранить возможности");
    }
  };
  const toggleResource = (resource: WakeProfile["availableResources"][number]) =>
    setDraft((current) => ({
      ...current,
      availableResources: current.availableResources.includes(resource)
        ? current.availableResources.filter((item) => item !== resource)
        : [...current.availableResources, resource],
    }));
  const toggleTask = (taskId: string) =>
    setDraft((current) => ({
      ...current,
      excludedTaskIds: current.excludedTaskIds.includes(taskId)
        ? current.excludedTaskIds.filter((item) => item !== taskId)
        : [...current.excludedTaskIds, taskId],
    }));
  return (
    <section className="mb-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Check aria-hidden="true" className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Что тебе подходит</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Ответы только исключают неудобные задания. Они не заменяют реальные эксперименты.
      </p>
      {!editing ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">
            Движение:{" "}
            {profile.movementLevel === "none"
              ? "нет"
              : profile.movementLevel === "light"
                ? "лёгкое"
                : "любое"}{" "}
            · доступно ресурсов: {profile.availableResources.length}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-10 shrink-0 rounded-xl border border-border px-3 text-xs font-semibold"
          >
            Изменить
          </button>
        </div>
      ) : (
        <>
          <label className="mt-4 block text-xs text-muted-foreground">Допустимое движение</label>
          <select
            aria-label="Допустимое движение"
            value={draft.movementLevel}
            onChange={(event) =>
              setDraft({
                ...draft,
                movementLevel: event.target.value as WakeProfile["movementLevel"],
              })
            }
            className="mt-1 min-h-12 w-full rounded-xl border border-border bg-secondary px-3 text-sm"
          >
            <option value="none">Без упражнений</option>
            <option value="light">Лёгкое движение</option>
            <option value="full">Любые упражнения</option>
          </select>
          <div className="mt-4 space-y-2">
            {(
              [
                ["water", "Есть вода"],
                ["bright_light", "Есть окно или яркий свет"],
                ["floor_space", "Есть свободное место"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleResource(value)}
                aria-pressed={draft.availableResources.includes(value)}
                className="flex min-h-11 w-full items-center justify-between rounded-xl bg-secondary px-3 text-left text-sm"
              >
                <span>{label}</span>
                {draft.availableResources.includes(value) && (
                  <Check aria-hidden="true" className="h-4 w-4 text-accent" />
                )}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Не предлагать конкретные задания</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["math", "Математика"],
                ["memory", "Память"],
                ["stroop", "Внимание"],
                ["reaction", "Реакция"],
                ["steps", "Ходьба"],
                ["squats", "Приседания"],
                ["shake", "Разминка"],
                ["water", "Вода"],
                ["window", "Яркий свет"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleTask(id)}
                aria-pressed={draft.excludedTaskIds.includes(id)}
                className={`min-h-10 rounded-xl border px-3 text-xs ${draft.excludedTaskIds.includes(id) ? "border-destructive/50 bg-destructive/10 text-red-300 line-through" : "border-border bg-secondary"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-xs text-muted-foreground">Обычный режим</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([2, 5, 10] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDraft({ ...draft, defaultDurationMinutes: value })}
                aria-pressed={draft.defaultDurationMinutes === value}
                className={`min-h-11 rounded-xl border text-sm ${draft.defaultDurationMinutes === value ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {value} мин
              </button>
            ))}
          </div>
          <button
            disabled={saving}
            onClick={() => void submit()}
            className="mt-4 min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Сохраняем…" : "Сохранить возможности"}
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
