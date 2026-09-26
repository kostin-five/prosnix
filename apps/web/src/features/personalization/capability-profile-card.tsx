import React from "react";
import { Check, ChevronRight } from "lucide-react";

import type { WakeProfile } from "../../shared/api/client.js";
import { TaskIcon, type TaskId } from "../tasks/task-icon.js";

const MOVEMENT_OPTIONS: Array<{
  value: WakeProfile["movementLevel"];
  title: string;
  description: string;
}> = [
  {
    value: "none",
    title: "Без упражнений",
    description: "Только задания для внимания и доступной среды",
  },
  {
    value: "light",
    title: "Только лёгкое движение",
    description: "Ходьба и мягкая разминка без интенсивной нагрузки",
  },
  {
    value: "full",
    title: "Могу выполнять любые упражнения",
    description: "Включая приседания и другие активные варианты",
  },
];

const EXERCISES: Array<{
  id: TaskId;
  title: string;
  description: string;
  levels: Array<WakeProfile["movementLevel"]>;
}> = [
  {
    id: "steps",
    title: "Пройтись",
    description: "Короткая ходьба по комнате или коридору",
    levels: ["light", "full"],
  },
  {
    id: "shake",
    title: "Мягкая разминка",
    description: "Движения руками, плечами и шеей без рывков",
    levels: ["light", "full"],
  },
  {
    id: "squats",
    title: "Приседания",
    description: "Пять спокойных повторений при наличии места",
    levels: ["full"],
  },
  {
    id: "pushups",
    title: "Отжимания",
    description: "От пола или с колен — под свой уровень",
    levels: ["full"],
  },
];

const OTHER_TASKS: Array<[TaskId, string]> = [
  ["math", "Математика"],
  ["memory", "Память"],
  ["stroop", "Внимание"],
  ["reaction", "Реакция"],
  ["water", "Вода"],
  ["window", "Яркий свет"],
];

export function CapabilityProfileCard({
  profile,
  saving,
  onSave,
  onCompleted,
  initiallyEditing = !profile.onboardingCompleted,
  catalogV9Enabled = import.meta.env.VITE_WAKE_TASK_CATALOG_V9_ENABLED === "true",
  wizard = false,
}: {
  profile: WakeProfile;
  saving: boolean;
  onSave: (profile: Omit<WakeProfile, "revision">) => Promise<void>;
  onCompleted?: () => void;
  initiallyEditing?: boolean;
  catalogV9Enabled?: boolean;
  wizard?: boolean;
}) {
  const cardRef = React.useRef<HTMLElement>(null);
  const [draft, setDraft] = React.useState(profile);
  const [editing, setEditing] = React.useState(initiallyEditing);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);
  const [movementChosen, setMovementChosen] = React.useState(profile.onboardingCompleted);
  React.useEffect(() => setDraft(profile), [profile]);

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    cardRef.current?.parentElement?.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setFeedback(null);
    try {
      await onSave({ ...draft, onboardingCompleted: true });
      setFeedback("Возможности сохранены");
      setEditing(false);
      onCompleted?.();
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
  const toggleTask = (taskId: TaskId) =>
    setDraft((current) => ({
      ...current,
      excludedTaskIds: current.excludedTaskIds.includes(taskId)
        ? current.excludedTaskIds.filter((item) => item !== taskId)
        : [...current.excludedTaskIds, taskId],
    }));
  const visibleExercises = EXERCISES.filter(
    ({ id, levels }) =>
      levels.includes(draft.movementLevel) && (id !== "pushups" || catalogV9Enabled),
  );
  const activeMovementAllowed = draft.availableResources.includes("active_movement");

  return (
    <section
      ref={cardRef}
      className="mb-4 min-w-0 max-w-full rounded-3xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <Check aria-hidden="true" className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">
          {wizard ? "Настройка протокола" : "Что тебе подходит"}
        </h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Мы назначим только явно разрешённые действия. Настройки можно изменить позже.
      </p>
      {wizard && editing && (
        <div className="mt-4" aria-label={`Шаг ${page + 1} из 4`}>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Шаг {page + 1} из 4</span>
            <span>{["Нагрузка", "Упражнения", "Ресурсы", "Длительность"][page]}</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((step) => (
              <span
                key={step}
                className={`h-1.5 rounded-full ${step <= page ? "bg-primary" : "bg-secondary"}`}
              />
            ))}
          </div>
        </div>
      )}
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
          {(!wizard || page === 0) && (
            <div className="motion-safe:animate-[onboarding-step-in_180ms_ease-out]">
              <p className="mt-5 text-sm font-semibold">Можешь выполнять упражнения?</p>
              <div className="mt-2 space-y-2">
                {MOVEMENT_OPTIONS.map((option) => {
                  const selected =
                    draft.movementLevel === option.value && (!wizard || movementChosen);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setDraft({ ...draft, movementLevel: option.value });
                        setMovementChosen(true);
                      }}
                      className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${selected ? "border-primary bg-primary/10" : "border-border bg-secondary/40"}`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"}`}
                      >
                        {selected && <Check className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(!wizard || page === 1) && (
            <div className="motion-safe:animate-[onboarding-step-in_180ms_ease-out]">
              {catalogV9Enabled && draft.movementLevel === "full" && (
                <button
                  type="button"
                  aria-pressed={activeMovementAllowed}
                  onClick={() => toggleResource("active_movement")}
                  className={`mt-3 flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left ${activeMovementAllowed ? "border-primary/50 bg-primary/8" : "border-border bg-secondary/40"}`}
                >
                  <span>
                    <span className="block text-sm font-semibold">Можно активные упражнения</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Например, отжимания от пола или с колен
                    </span>
                  </span>
                  {activeMovementAllowed ? (
                    <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <ChevronRight
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                    />
                  )}
                </button>
              )}

              {visibleExercises.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold">Какие упражнения можно предлагать?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Отключи любое отдельно — это не повлияет на остальные варианты.
                  </p>
                  <div className="mt-3 space-y-2">
                    {visibleExercises.map((exercise) => {
                      const permitted = exercise.id !== "pushups" || activeMovementAllowed;
                      const enabled = permitted && !draft.excludedTaskIds.includes(exercise.id);
                      return (
                        <button
                          key={exercise.id}
                          type="button"
                          aria-pressed={enabled}
                          onClick={() => permitted && toggleTask(exercise.id)}
                          disabled={!permitted}
                          className={`flex min-h-20 w-full items-center gap-3 rounded-2xl border p-3 text-left ${enabled ? "border-accent/40 bg-accent/8" : "border-border bg-secondary/40 opacity-65"}`}
                        >
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-accent">
                            <TaskIcon taskId={exercise.id} className="h-6 w-6" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{exercise.title}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {exercise.description}
                            </span>
                          </span>
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${enabled ? "border-accent bg-accent text-accent-foreground" : "border-muted-foreground/50"}`}
                          >
                            {enabled && <Check className="h-4 w-4" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {wizard && visibleExercises.length === 0 && (
                <p className="mt-5 rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
                  Ты выбрал режим без упражнений. При желании вернись назад и измени нагрузку.
                </p>
              )}
            </div>
          )}

          {(!wizard || page === 2) && (
            <div className="motion-safe:animate-[onboarding-step-in_180ms_ease-out]">
              <p className="mt-5 text-sm font-semibold">Что будет доступно рядом?</p>
              <div className="mt-2 space-y-2">
                {(
                  [
                    ["water", "Есть вода", "Можно заранее поставить стакан рядом"],
                    [
                      "bright_light",
                      "Есть окно или яркий свет",
                      "Не нужно смотреть прямо на солнце",
                    ],
                    ["floor_space", "Есть свободное место", "Можно безопасно встать и двигаться"],
                    ...(catalogV9Enabled
                      ? ([
                          [
                            "wash_access",
                            "Можно умыться",
                            "Есть доступ к раковине и прохладной воде",
                          ],
                        ] as const)
                      : []),
                  ] as const
                ).map(([value, title, description]) => {
                  const selected = draft.availableResources.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleResource(value)}
                      aria-pressed={selected}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left ${selected ? "border-primary/50 bg-primary/8" : "border-border bg-secondary/40"}`}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {description}
                        </span>
                      </span>
                      {selected ? (
                        <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
                      ) : (
                        <ChevronRight
                          aria-hidden="true"
                          className="h-5 w-5 shrink-0 text-muted-foreground"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="mt-5 text-xs text-muted-foreground">
                Другие задания, которые можно исключить
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {OTHER_TASKS.map(([id, label]) => {
                  const excluded = draft.excludedTaskIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleTask(id)}
                      aria-pressed={!excluded}
                      className={`min-h-10 rounded-xl border px-3 text-xs ${excluded ? "border-destructive/50 bg-destructive/10 text-red-300 line-through" : "border-border bg-secondary"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(!wizard || page === 3) && (
            <div className="motion-safe:animate-[onboarding-step-in_180ms_ease-out]">
              <p className="mt-5 text-sm font-semibold">Обычная длительность</p>
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
            </div>
          )}
          {wizard && page > 0 && (
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              className="mt-5 min-h-12 w-full rounded-2xl border border-border bg-secondary/40 text-sm font-semibold"
            >
              Назад
            </button>
          )}
          {wizard && page < 3 ? (
            <button
              type="button"
              disabled={page === 0 && !movementChosen}
              onClick={() => goToPage(page + 1)}
              className="mt-2 min-h-14 w-full rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
            >
              Далее
            </button>
          ) : (
            <button
              disabled={saving}
              onClick={() => void submit()}
              className="mt-5 min-h-14 w-full rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Сохраняем…" : "Сохранить возможности"}
            </button>
          )}
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
