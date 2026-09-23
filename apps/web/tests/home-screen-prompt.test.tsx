import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  checkTelegramHomeScreenStatus: vi.fn(),
  addTelegramToHomeScreen: vi.fn(),
}));

vi.mock("../src/telegram/bridge.js", () => bridge);

import { HomeScreenPrompt } from "../src/features/onboarding/home-screen-prompt.js";

describe("предложение ярлыка после первого пробуждения", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("вызывает Telegram API только после явного нажатия и больше не повторяется", async () => {
    bridge.checkTelegramHomeScreenStatus.mockResolvedValue("missed");
    bridge.addTelegramToHomeScreen.mockReturnValue(true);

    await act(async () => {
      root.render(<HomeScreenPrompt firstCompletion />);
      await Promise.resolve();
    });

    expect(bridge.addTelegramToHomeScreen).not.toHaveBeenCalled();
    const add = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Добавить на главный экран"),
    );
    act(() => add?.click());

    expect(bridge.addTelegramToHomeScreen).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("prosnix.home-screen-prompt.handled.v1")).toBe("1");
    expect(container.textContent).toBe("");
  });

  it("показывает ручную инструкцию, если API недоступен", async () => {
    bridge.checkTelegramHomeScreenStatus.mockResolvedValue("unsupported");

    await act(async () => {
      root.render(<HomeScreenPrompt firstCompletion />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("пункт «Добавить на главный экран»");
    expect(container.textContent).not.toContain("Проверяем поддержку Telegram");
  });

  it("не показывается после последующих завершений", () => {
    act(() => root.render(<HomeScreenPrompt firstCompletion={false} />));
    expect(container.textContent).toBe("");
    expect(bridge.checkTelegramHomeScreenStatus).not.toHaveBeenCalled();
  });
});
