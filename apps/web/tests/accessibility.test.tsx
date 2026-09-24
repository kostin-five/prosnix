import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import App from "../src/app/App.js";
import { WakeContextSheet } from "../src/features/personalization/wake-context-sheet.js";
import { TaskIcon } from "../src/features/tasks/task-icon.js";
import { TaskTimerVisual } from "../src/features/tasks/task-timer-visual.js";

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("мобильные состояния доступности", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    delete window.Telegram;
    window.history.replaceState({}, "", "/");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("озвучивает безопасную ошибку входа и даёт понятное действие", async () => {
    await import("../src/features/bootstrap/bootstrap-error-screen.js");
    act(() => root.render(<App />));
    await settle();
    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert?.textContent).toContain("Не удалось безопасно войти");
    expect(alert?.querySelector("button")?.textContent).toBe("Повторить");
  });

  it("даёт клавиатуре и скринридеру выбрать контекст и длительность", () => {
    act(() =>
      root.render(
        <WakeContextSheet
          defaultDuration={5}
          profileComplete
          busy={false}
          onCancel={() => undefined}
          onOpenProfile={() => undefined}
          onStart={() => undefined}
        />,
      ),
    );
    expect(container.querySelectorAll("button[aria-pressed]")).toHaveLength(7);
    expect(container.textContent).toContain("сравнивать похожие ситуации");
  });

  it("показывает согласованные векторные иконки для всех заданий", () => {
    const taskIds = [
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
    ] as const;
    act(() =>
      root.render(
        <div>
          {taskIds.map((taskId) => (
            <TaskIcon key={taskId} taskId={taskId} />
          ))}
        </div>,
      ),
    );
    expect(container.querySelectorAll("svg")).toHaveLength(taskIds.length);
    expect(container.textContent).not.toMatch(/[🧮🧠👁⚡🚶💪🤸💧☀🌅]/u);
  });

  it("озвучивает активный таймер и сохраняет числовой прогресс", () => {
    act(() => root.render(<TaskTimerVisual taskId="window" remaining={18} total={30} />));
    const timer = container.querySelector('[role="timer"]');
    expect(timer?.getAttribute("aria-label")).toBe("Осталось 18 секунд");
    expect(timer?.textContent).toContain("18");
    expect(timer?.querySelector(".motion-reduce\\:transition-none")).not.toBeNull();
  });
});
