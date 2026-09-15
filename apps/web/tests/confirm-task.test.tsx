import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmTask } from "../src/app/App.js";

describe("подтверждаемое задание воды", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("не разрешает отметить воду раньше десяти секунд", async () => {
    const onDone = vi.fn();
    act(() => root.render(<ConfirmTask taskId="water" durationMinutes={5} onDone={onDone} />));
    const start = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (item) => item.textContent?.trim() === "Начать",
    );
    act(() => start?.click());

    let confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes("Выпил"),
    );
    expect(confirm?.disabled).toBe(true);
    for (let second = 0; second < 9; second += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
    }
    confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes("Выпил"),
    );
    expect(confirm?.disabled).toBe(true);
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes("Выпил"),
    );
    expect(confirm?.disabled).toBe(false);
    act(() => confirm?.click());
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
