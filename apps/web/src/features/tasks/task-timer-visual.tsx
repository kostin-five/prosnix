import type { TaskId } from "./task-icon.js";
import { Check } from "lucide-react";

export function TaskTimerVisual({
  taskId,
  remaining,
  total,
  waiting = false,
}: {
  taskId: TaskId;
  remaining: number;
  total: number;
  waiting?: boolean;
}) {
  const complete = remaining <= 0;
  const progress = total <= 0 ? 1 : Math.min(1, Math.max(0, (total - remaining) / total));
  const circumference = 2 * Math.PI * 54;
  const lightTask = taskId === "window" || taskId === "curtains";

  return (
    <div
      className="pointer-events-none relative grid h-40 w-40 place-items-center"
      role="timer"
      aria-label={
        waiting
          ? "Таймер ещё не начат"
          : complete
            ? "Таймер завершён"
            : `Осталось ${remaining} секунд`
      }
      data-testid="task-timer-visual"
    >
      {lightTask && (
        <div
          data-testid="task-timer-light"
          className="absolute inset-4 rounded-full bg-amber-400/15 blur-xl motion-safe:animate-pulse"
          aria-hidden="true"
        />
      )}
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
        <circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-secondary"
        />
        <circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="text-primary transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
        />
      </svg>
      <div
        className={`relative flex flex-col items-center ${complete ? "text-green-400" : "text-primary"}`}
      >
        {complete ? (
          <Check className="h-9 w-9" strokeWidth={2.5} />
        ) : (
          <span className="text-4xl font-black tabular-nums">{remaining}</span>
        )}
        {!complete && <span className="text-[11px] font-medium text-muted-foreground">секунд</span>}
      </div>
    </div>
  );
}

export default TaskTimerVisual;
