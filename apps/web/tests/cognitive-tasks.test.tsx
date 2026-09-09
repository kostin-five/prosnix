import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MathTask, MemoryTask, ReactionTask, StroopTask } from "../src/app/App.js";

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const result = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!result) throw new Error(`Button not found: ${label}`);
  return result;
}

describe("честное завершение когнитивных заданий", () => {
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
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("не принимает реакцию до сигнала и только один раз на один сигнал", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const onDone = vi.fn();
    act(() => root.render(<ReactionTask durationMinutes={5} onDone={onDone} />));
    const waiting = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Ожидание сигнала"]',
    );
    expect(waiting?.disabled).toBe(true);
    act(() => {
      waiting?.click();
      waiting?.click();
      waiting?.click();
    });
    expect(onDone).not.toHaveBeenCalled();

    for (let second = 0; second < 4; second += 1) {
      act(() => vi.advanceTimersByTime(1_000));
    }
    const allowed = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Нажать по сигналу"]',
    );
    expect(allowed?.disabled).toBe(false);
    act(() => {
      allowed?.click();
      allowed?.click();
      allowed?.click();
    });
    expect(container.textContent).toContain("Раунд 2 из 3");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("засчитывает только реакцию быстрее 500 мс", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const onDone = vi.fn();
    act(() => root.render(<ReactionTask durationMinutes={5} onDone={onDone} />));
    act(() => vi.advanceTimersByTime(4_000));
    act(() => vi.advanceTimersByTime(500));
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Нажать по сигналу"]')?.click(),
    );

    expect(container.textContent).toContain("Нужно быстрее 500 мс");
    expect(container.textContent).toContain("Раунд 1 из 3");
    expect(onDone).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(800));
    act(() => vi.advanceTimersByTime(4_000));
    act(() => vi.advanceTimersByTime(499));
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Нажать по сигналу"]')?.click(),
    );

    expect(container.textContent).toContain("Раунд 2 из 3");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("не продвигает внимание после неправильного ответа", () => {
    const onDone = vi.fn();
    act(() => root.render(<StroopTask durationMinutes={5} onDone={onDone} />));
    const word = container.querySelector<HTMLElement>('[data-testid="stroop-word"]');
    const answerByClass: Record<string, string> = {
      "text-red-400": "Красный",
      "text-blue-400": "Синий",
      "text-green-400": "Зелёный",
      "text-yellow-300": "Жёлтый",
      "text-purple-400": "Фиолетовый",
    };
    const correctLabel = Object.entries(answerByClass).find(([className]) =>
      word?.classList.contains(className),
    )?.[1];
    if (!correctLabel) throw new Error("Stroop answer color not found");
    const wrong = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (item) => item.textContent?.trim() !== correctLabel,
    );
    if (!wrong) throw new Error("Wrong Stroop answer not found");
    act(() => wrong.click());
    act(() => vi.advanceTimersByTime(600));
    expect(container.textContent).toContain("Правильных: 0/3");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("после ошибки памяти показывает новую последовательность без зачёта", () => {
    const onDone = vi.fn();
    act(() => root.render(<MemoryTask durationMinutes={5} onDone={onDone} />));
    const original = [...container.querySelectorAll<HTMLElement>("[data-memory-digit]")].map(
      (item) => Number(item.dataset.memoryDigit),
    );
    for (let second = 0; second < 4; second += 1) {
      act(() => vi.advanceTimersByTime(1_000));
    }
    const wrong = original.map((digit, index) => (index === 0 ? (digit + 1) % 10 : digit));
    act(() => wrong.forEach((digit) => button(container, String(digit)).click()));
    const submit = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Проверить последовательность"]',
    );
    act(() => submit?.click());
    expect(container.textContent).toContain("Правильно 0/2");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("показывает увеличенные цели десятиминутного режима", () => {
    act(() => root.render(<MathTask durationMinutes={10} onDone={() => undefined} />));
    expect(container.textContent).toContain("Правильных: 0/5");
    act(() => root.render(<MemoryTask durationMinutes={10} onDone={() => undefined} />));
    expect(container.textContent).toContain("Правильно 0/3");
    act(() => root.render(<ReactionTask durationMinutes={10} onDone={() => undefined} />));
    expect(container.textContent).toContain("Раунд 1 из 5");
  });
});
