import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MorningGoalBanner,
  MorningGoalCard,
} from "../src/features/personalization/morning-goal-card.js";
import { readMorningGoal } from "../src/features/personalization/morning-preferences.js";

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) =>
    item.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

describe("личная утренняя цель", () => {
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
  });

  it("сохраняет цель клавишей Enter и позволяет удалить её", () => {
    act(() => root.render(<MorningGoalCard storageScope="user-a" />));
    act(() => findButton(container, "Добавить цель").click());
    const input = container.querySelector<HTMLInputElement>("#morning-goal");
    if (!input) throw new Error("Morning goal input not found");
    expect(input.maxLength).toBe(120);
    expect(input.getAttribute("enterkeyhint")).toBe("done");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Закончить проект");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(readMorningGoal("user-a")).toBe("Закончить проект");

    act(() => root.render(<MorningGoalCard storageScope="user-a" />));
    act(() => findButton(container, "Изменить цель").click());
    act(() => findButton(container, "Удалить цель").click());
    expect(readMorningGoal("user-a")).toBe("");
  });

  it("показывает утром только непустую личную фразу", () => {
    act(() => root.render(<MorningGoalBanner goal="Позвонить родителям" />));
    expect(container.textContent).toContain("Позвонить родителям");
    expect(container.textContent).toContain("Сейчас — только оцени бодрость");

    act(() => root.render(<MorningGoalBanner goal="" />));
    expect(container.textContent).toBe("");
  });

  it("позволяет оставить цель пустой без блокировки", () => {
    act(() => root.render(<MorningGoalCard storageScope="user-a" />));
    act(() => findButton(container, "Добавить цель").click());
    act(() => findButton(container, "Не указывать").click());
    expect(readMorningGoal("user-a")).toBe("");
    expect(container.textContent).toContain("Цель не указана");
  });
});
