import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskMotionVisual } from "../src/features/tasks/task-motion-visual.js";
import type { TaskId } from "../src/features/tasks/task-icon.js";

const TASK_IDS: TaskId[] = [
  "math",
  "memory",
  "stroop",
  "reaction",
  "steps",
  "squats",
  "shake",
  "water",
  "window",
  "curtains",
  "sit_edge",
  "cool_wash",
  "pushups",
];

function useReducedMotion(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("визуальное сопровождение заданий", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useReducedMotion(false);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("имеет отдельное состояние для каждого задания каталога", () => {
    for (const taskId of TASK_IDS) {
      act(() => root.render(<TaskMotionVisual taskId={taskId} />));
      expect(container.querySelector("figure")?.getAttribute("data-task-motion")).toBe(taskId);
    }
  });

  it("отключает декоративное движение по системной настройке", () => {
    useReducedMotion(true);
    act(() => root.render(<TaskMotionVisual taskId="squats" />));

    const visual = container.querySelector("figure");
    expect(visual?.getAttribute("data-motion")).toBe("reduced");
    expect(visual?.innerHTML).not.toContain("animate-bounce");
    expect(visual?.innerHTML).not.toContain("animate-ping");
  });
});
