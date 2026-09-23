import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/features/feedback/experiment-feedback-card.js", () => ({
  ExperimentFeedbackCard: () => <div>feedback</div>,
}));
vi.mock("../src/features/pro-interest/pro-interest-card.js", () => ({
  ProInterestCard: () => <div>pro</div>,
}));

import { StartRatingScreen, TasksContainer, initialProtocolScreen } from "../src/app/App.js";
import StatsResearchCards from "../src/features/research/stats-research-cards.js";

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

  it("скрывает полный протокол, показывает следующий шаг и открывает состав по кнопке", () => {
    act(() => {
      root.render(
        <TasksContainer
          taskIds={["math", "water", "window"]}
          taskIndex={0}
          durationMinutes={5}
          onDone={() => undefined}
        />,
      );
    });

    expect(container.textContent).not.toContain("Почему этот протокол");
    expect(container.textContent).toContain("Дальше");
    expect(container.textContent).toContain("Стакан воды");
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    const protocolButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Протокол",
    );
    expect(protocolButton).toBeTruthy();
    act(() => protocolButton?.click());

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("Твой протокол");
  });

  it("не показывает общую справку об аналитике", () => {
    act(() => root.render(<StatsResearchCards refreshKey={1} />));

    expect(container.textContent).not.toContain("Справка об аналитике");
  });
});
