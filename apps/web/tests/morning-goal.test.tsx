import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.unstubAllGlobals();
  });

  it("в demo сохраняет цель клавишей Enter и позволяет удалить её", async () => {
    act(() => root.render(<MorningGoalCard storageScope="demo" />));
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
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(readMorningGoal("demo")).toBe("Закончить проект");

    act(() => root.render(<MorningGoalCard storageScope="demo" />));
    act(() => findButton(container, "Изменить цель").click());
    await act(async () => findButton(container, "Удалить цель").click());
    expect(readMorningGoal("demo")).toBe("");
  });

  it("показывает утром только непустую личную фразу", () => {
    act(() => root.render(<MorningGoalBanner goal="Позвонить родителям" />));
    expect(container.textContent).toContain("Позвонить родителям");
    expect(container.textContent).toContain("Сейчас — только оцени бодрость");

    act(() => root.render(<MorningGoalBanner goal="" />));
    expect(container.textContent).toBe("");
  });

  it("позволяет оставить цель пустой без блокировки", async () => {
    act(() => root.render(<MorningGoalCard storageScope="demo" />));
    act(() => findButton(container, "Добавить цель").click());
    await act(async () => findButton(container, "Не указывать").click());
    expect(readMorningGoal("demo")).toBe("");
    expect(container.textContent).toContain("Цель не указана");
  });

  it("не отправляет прежнюю локальную цель без явного сохранения", async () => {
    window.localStorage.setItem(
      "prosnix.morning-preferences.v1:user-a",
      JSON.stringify({ goal: "Построить своё дело", reviews: [] }),
    );
    let serverGoal = { text: "", revision: 0 };
    const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { text: string };
        serverGoal = { text: body.text, revision: serverGoal.revision + 1 };
      }
      return Response.json(serverGoal);
    });
    vi.stubGlobal("fetch", fetcher);
    await act(async () => root.render(<MorningGoalCard storageScope="user-a" />));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/me/life-goal");
    expect(container.textContent).toContain("Цель не указана");
    act(() => findButton(container, "Добавить цель").click());
    expect(container.querySelector<HTMLInputElement>("#morning-goal")?.value).toBe(
      "Построить своё дело",
    );
    await act(async () => findButton(container, "Сохранить").click());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(serverGoal.text).toBe("Построить своё дело");
    expect(readMorningGoal("user-a")).toBe("");
    act(() => findButton(container, "Изменить цель").click());
    await act(async () => findButton(container, "Удалить цель").click());
    expect(serverGoal.text).toBe("");
    expect(readMorningGoal("user-a")).toBe("");
  });
});
