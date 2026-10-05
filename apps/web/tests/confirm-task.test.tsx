import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmTask } from "../src/features/tasks/confirm-task.js";

describe("подтверждаемые задания с таймером", () => {
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

  it("даёт двадцать секунд на пять приседаний", async () => {
    const onDone = vi.fn();
    act(() => root.render(<ConfirmTask taskId="squats" durationMinutes={5} onDone={onDone} />));
    const start = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (item) => item.textContent?.trim() === "Начать",
    );
    act(() => start?.click());

    expect(container.textContent).toContain("20");
    let confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes("Сделал"),
    );
    expect(confirm?.disabled).toBe(true);

    for (let second = 0; second < 19; second += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
    }
    confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes("Сделал"),
    );
    expect(confirm?.disabled).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes("Сделал"),
    );
    expect(confirm?.disabled).toBe(false);
  });

  it("в новой пятиминутной версии увеличивает время действия", async () => {
    const onDone = vi.fn();
    act(() =>
      root.render(
        <ConfirmTask taskId="water" durationMinutes={5} protocolVersion={10} onDone={onDone} />,
      ),
    );
    act(() => {
      [...container.querySelectorAll<HTMLButtonElement>("button")]
        .find((item) => item.textContent?.trim() === "Начать")
        ?.click();
    });
    expect(container.textContent).toContain("25");
    for (let second = 0; second < 24; second += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
    }
    const confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes("Выпил"),
    );
    expect(confirm?.disabled).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(confirm?.disabled).toBe(false);
  });

  it.each([
    ["breathing", 30, "Готово"],
    ["water", 15, "Выпил"],
    ["window", 15, "Готово"],
    ["curtains", 10, "Открыл"],
  ] as const)(
    "в версии 13 завершает короткое действие %s без ожидания",
    async (taskId, seconds, cta) => {
      const onDone = vi.fn();
      const onRemainingChange = vi.fn();
      act(() =>
        root.render(
          <ConfirmTask
            taskId={taskId}
            durationMinutes={5}
            protocolVersion={13}
            onDone={onDone}
            onRemainingChange={onRemainingChange}
          />,
        ),
      );
      act(() => container.querySelector<HTMLButtonElement>("button.ps-primary-button")?.click());
      expect(onRemainingChange).toHaveBeenCalledWith(seconds);
      for (let second = 0; second < seconds; second += 1) {
        await act(async () => vi.advanceTimersByTimeAsync(1_000));
      }
      const confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
        item.textContent?.includes(cta),
      );
      expect(confirm?.disabled).toBe(false);
      expect(onRemainingChange).toHaveBeenCalledWith(0);
    },
  );

  it.each([
    ["cool_wash", 20, "Умылся"],
    ["pushups", 25, "Сделал"],
  ] as const)("не разрешает подтвердить %s до конца таймера", async (taskId, seconds, cta) => {
    const onDone = vi.fn();
    act(() => root.render(<ConfirmTask taskId={taskId} durationMinutes={5} onDone={onDone} />));
    const start = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (item) => item.textContent?.trim() === "Начать",
    );
    act(() => start?.click());

    expect(container.textContent).toContain(String(seconds));
    for (let second = 0; second < seconds - 1; second += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
    }
    let confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes(cta),
    );
    expect(confirm?.disabled).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes(cta),
    );
    expect(confirm?.disabled).toBe(false);
  });

  it("ставит таймер обычного задания на паузу и продолжает после нажатия", async () => {
    const onDone = vi.fn();
    const onPauseChange = vi.fn();
    act(() =>
      root.render(
        <ConfirmTask
          taskId="sit_edge"
          durationMinutes={5}
          onDone={onDone}
          onPauseChange={onPauseChange}
        />,
      ),
    );
    act(() => container.querySelector<HTMLButtonElement>("button.ps-primary-button")?.click());
    for (let second = 0; second < 3; second += 1)
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
    const timer = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Поставить таймер на паузу"]',
    );
    act(() => timer?.click());
    expect(onPauseChange).toHaveBeenLastCalledWith(true);
    expect(container.querySelector('[data-testid="task-timer-pause-icon"]')).not.toBeNull();
    expect(container.querySelector('[role="timer"]')?.getAttribute("aria-label")).toContain(
      "7 секунд",
    );
    await act(async () => vi.advanceTimersByTimeAsync(12_000));
    expect(container.querySelector('[role="timer"]')?.getAttribute("aria-label")).toContain(
      "7 секунд",
    );
    expect(onDone).not.toHaveBeenCalled();
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Продолжить таймер"]')?.click(),
    );
    expect(onPauseChange).toHaveBeenLastCalledWith(false);
    expect(container.querySelector('[data-testid="task-timer-pause-icon"]')).toBeNull();
    for (let second = 0; second < 7; second += 1)
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(container.querySelector('[role="timer"]')?.getAttribute("aria-label")).toBe(
      "Таймер завершён",
    );
  });

  it("автоматически отправляет источник timer один раз и останавливается при скрытии", async () => {
    const onDone = vi.fn();
    act(() =>
      root.render(
        <ConfirmTask
          taskId="sit_edge"
          durationMinutes={5}
          interactionMode="hands_free"
          autoStart
          onDone={onDone}
        />,
      ),
    );
    for (let second = 0; second < 2; second += 1)
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(onDone).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Продолжить таймер"]')?.click(),
    );
    for (let second = 0; second < 8; second += 1)
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({
      completionSource: "timer",
      correct: 1,
      total: 1,
    });
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("показывает короткий таймер наблюдения только в новой версии", async () => {
    const onDone = vi.fn();
    act(() =>
      root.render(
        <ConfirmTask
          taskId="notice_three"
          durationMinutes={2}
          protocolVersion={12}
          interactionMode="hands_free"
          autoStart
          onDone={onDone}
        />,
      ),
    );
    expect(container.querySelector('[role="timer"]')?.getAttribute("aria-label")).toBe(
      "Осталось 15 секунд",
    );
    for (let second = 0; second < 15; second += 1)
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({ completionSource: "timer" });
  });
});
