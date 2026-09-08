import type { SVGProps } from "react";

export type TaskId =
  | "math"
  | "memory"
  | "stroop"
  | "reaction"
  | "steps"
  | "squats"
  | "shake"
  | "water"
  | "window"
  | "curtains";

const ICON_PATHS: Record<TaskId, string> = {
  math: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 4h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4",
  memory:
    "M9.5 4.5A3.5 3.5 0 0 0 6 8v.4A3.5 3.5 0 0 0 5 15v.5A3.5 3.5 0 0 0 8.5 19H12V6.5a2 2 0 0 0-2.5-2Zm5 0A3.5 3.5 0 0 1 18 8v.4a3.5 3.5 0 0 1 1 6.6v.5a3.5 3.5 0 0 1-3.5 3.5H12V6.5a2 2 0 0 1 2.5-2ZM8 9h4m0 5H8m4-2h4",
  stroop:
    "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Zm6.5 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z",
  reaction: "M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z",
  steps:
    "M8.5 4.5c1.4 0 2.5 1.8 2.5 4s-1.1 4-2.5 4S6 10.7 6 8.5s1.1-4 2.5-4Zm7 7c1.4 0 2.5 1.8 2.5 4s-1.1 4-2.5 4-2.5-1.8-2.5-4 1.1-4 2.5-4ZM4 15c1.5-1 4.5-1 6 0m4-13c1.5-1 4.5-1 6 0",
  squats: "M7 8v8m10-8v8M4 10v4m16-4v4M7 12h10M2.5 9v6m19-6v6",
  shake:
    "M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 2v6m0 0-4 8m4-8 4 8M5 8l4 2m10-2-4 2M3 5 1 7m20-2 2 2M4 2 2 3m16-1 2 1",
  water: "M12 2S6 9 6 14a6 6 0 0 0 12 0c0-5-6-12-6-12Zm-3 13c.5 2 2 3 4 3",
  window:
    "M12 2v3m0 14v3M4.9 4.9 7 7m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1M8.5 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z",
  curtains:
    "M4 3h16M6 3v18m12-18v18M6 5c4 1 4 5 0 7 4 2 4 6 0 7m12-14c-4 1-4 5 0 7-4 2-4 6 0 7M10 12h4",
};

export function TaskIcon({
  taskId,
  className = "h-5 w-5",
  decorative = true,
}: {
  taskId: TaskId;
  className?: string;
  decorative?: boolean;
}) {
  const accessibility: SVGProps<SVGSVGElement> = decorative
    ? { "aria-hidden": true }
    : { "aria-label": `Иконка задания ${taskId}` };
  return (
    <svg
      data-task-icon={taskId}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...accessibility}
    >
      <path d={ICON_PATHS[taskId]} />
    </svg>
  );
}
