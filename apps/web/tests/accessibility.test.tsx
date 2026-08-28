import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import App from "../src/app/App.js";

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
    act(() => root.render(<App />));
    await settle();
    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert?.textContent).toContain("Не удалось безопасно войти");
    expect(alert?.querySelector("button")?.textContent).toBe("Повторить");
  });
});
