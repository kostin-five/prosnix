import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/features/feedback/experiment-feedback-card.js", () => ({
  ExperimentFeedbackCard: () => <div>feedback</div>,
}));
vi.mock("../src/features/pro-interest/pro-interest-card.js", () => ({
  ProInterestCard: () => <div>pro</div>,
}));

import { TasksContainer, initialProtocolScreen } from "../src/app/App.js";
import StatsResearchCards from "../src/features/research/stats-research-cards.js";
import { StartRatingScreen } from "../src/features/session/rating-screens.js";

describe("утренний вход и компактный shell", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("направляет wake deep link сразу к исходной оценке", () => {
    expect(initialProtocolScreen(undefined, "wake")).toBe("startRating");
    expect(initialProtocolScreen(undefined, null)).toBe("home");
    expect(initialProtocolScreen(undefined, "wake", false)).toBe("onboarding");
  });

  it("не принимает исходную оценку до подтверждения серверной сессии", () => {
    const onDone = vi.fn();
    const onRetry = vi.fn();
    act(() => {
      root.render(
        <StartRatingScreen onDone={onDone} ready={false} busy={false} onRetry={onRetry} />,
      );
    });

    const rating = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "5",
    );
    act(() => rating?.click());
    const submit = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Подготавливаем протокол"),
    );
    expect(submit?.hasAttribute("disabled")).toBe(true);
    act(() => submit?.click());
    expect(onDone).not.toHaveBeenCalled();

    const retry = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Повторить подключение"),
    );
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("скрывает полный протокол, показывает следующий шаг и открывает состав по кнопке", async () => {
    await Promise.all([
      import("../src/features/tasks/protocol-sheet.js"),
      import("../src/features/tasks/task-motion-visual.js"),
      import("../src/features/tasks/task-sound-toggle.js"),
    ]);
    await act(async () => {
      root.render(
        <TasksContainer
          taskIds={["math", "water", "window"]}
          taskIndex={0}
          durationMinutes={5}
          onDone={() => undefined}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).not.toContain("Почему этот протокол");
    expect(container.textContent).toContain("Дальше");
    expect(container.textContent).toContain("Стакан воды");
    expect(container.textContent).toContain("осталось");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[data-testid="task-experience-shell"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-motion-region"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-interaction-region"]')).not.toBeNull();
    expect(container.textContent).toContain("Переход произойдёт после подтверждения");

    const protocolButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Протокол",
    );
    expect(protocolButton).toBeTruthy();
    await act(async () => {
      protocolButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("Твой протокол");
  });

  it("сохраняет стабильный shell и показывает ожидание ответа API", async () => {
    await Promise.all([
      import("../src/features/tasks/task-motion-visual.js"),
      import("../src/features/tasks/task-sound-toggle.js"),
    ]);
    await act(async () => {
      root.render(
        <TasksContainer
          taskIds={["water", "math"]}
          taskIndex={0}
          durationMinutes={5}
          submitting
          onDone={() => undefined}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const shell = container.querySelector('[data-testid="task-experience-shell"]');
    expect(shell).not.toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-submit-region"]')?.textContent).toContain(
      "Подтверждаем шаг на сервере",
    );
  });

  it("не показывает общую справку об аналитике", () => {
    act(() => root.render(<StatsResearchCards refreshKey={1} />));

    expect(container.textContent).not.toContain("Справка об аналитике");
  });
});
