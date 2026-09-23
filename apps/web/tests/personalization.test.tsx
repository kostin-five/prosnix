import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapabilityProfileCard } from "../src/features/personalization/capability-profile-card.js";
import { CapabilityOnboardingScreen } from "../src/features/personalization/capability-onboarding-screen.js";
import { WakeContextSheet } from "../src/features/personalization/wake-context-sheet.js";
import {
  WakeRoutineCard,
  WakeRoutineChecklist,
} from "../src/features/personalization/wake-routine-card.js";

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const value = [...container.querySelectorAll("button")].find((item) =>
    item.textContent?.includes(label),
  );
  if (!value) throw new Error(`Button not found: ${label}`);
  return value;
}

describe("персонализация пробуждения", () => {
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
    vi.unstubAllGlobals();
  });

  it("восстанавливает прогресс рутины конкретной сессии с сервера", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        run: {
          sessionId: "session-1",
          items: [{ id: "water", title: "Выпить воды" }],
          completedItemIds: ["water"],
          revision: 2,
          completedAt: "2026-09-04T06:04:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await act(async () => {
      root.render(
        <WakeRoutineChecklist
          sessionId="session-1"
          routine={{ enabled: true, items: [{ id: "water", title: "Выпить воды" }], revision: 1 }}
          demo={false}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fetcher).toHaveBeenCalledWith("/api/v1/sessions/session-1/routine", {
      credentials: "same-origin",
    });
    expect(findButton(container, "Выпить воды").getAttribute("aria-pressed")).toBe("true");
  });

  it("выбирает контекст и короткий режим без обязательной анкеты", () => {
    const onStart = vi.fn();
    act(() =>
      root.render(
        <WakeContextSheet
          defaultDuration={5}
          profileComplete={false}
          busy={false}
          onCancel={() => undefined}
          onOpenProfile={() => undefined}
          onStart={onStart}
        />,
      ),
    );
    expect(container.textContent).toContain("без упражнений");
    act(() => findButton(container, "После короткого сна").click());
    act(() => findButton(container, "2 мин").click());
    const startButton = findButton(container, "Начать пробуждение");
    expect(startButton.parentElement?.className).toContain("shrink-0");
    act(() => startButton.click());
    expect(onStart).toHaveBeenCalledWith("short_nap", 2);
  });

  it("сохраняет ограничения и рутину как отдельные настройки", async () => {
    const onProfileSave = vi.fn(async () => undefined);
    act(() =>
      root.render(
        <CapabilityProfileCard
          profile={{
            movementLevel: "none",
            availableResources: [],
            excludedTaskIds: [],
            defaultDurationMinutes: 5,
            onboardingCompleted: false,
            revision: 0,
          }}
          saving={false}
          onSave={onProfileSave}
        />,
      ),
    );
    act(() => findButton(container, "Могу выполнять любые упражнения").click());
    act(() => findButton(container, "Приседания").click());
    await act(async () => findButton(container, "Сохранить возможности").click());
    expect(onProfileSave).toHaveBeenCalledWith(
      expect.objectContaining({ excludedTaskIds: ["squats"], onboardingCompleted: true }),
    );

    const onRoutineSave = vi.fn(async () => undefined);
    act(() =>
      root.render(
        <WakeRoutineCard
          routine={{ enabled: false, items: [], revision: 0 }}
          saving={false}
          onSave={onRoutineSave}
        />,
      ),
    );
    act(() => findButton(container, "Развернуть").click());
    act(() => findButton(container, "Добавить пункт").click());
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Пункт рутины 1"]');
    if (!input) throw new Error("Routine input not found");
    expect(input.placeholder).toBe("Например, выпить воды");
    expect(input.className).toContain("w-full");
    expect(input.parentElement?.className).toContain("flex-col");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Выпить воды");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!toggle) throw new Error("Routine toggle not found");
    act(() => toggle.click());
    await act(async () => findButton(container, "Сохранить рутину").click());
    expect(onRoutineSave).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        items: [expect.objectContaining({ title: "Выпить воды" })],
      }),
    );
  });

  it("просит отдельные разрешения для умывания и активных упражнений v9", async () => {
    const onSave = vi.fn(async () => undefined);
    act(() =>
      root.render(
        <CapabilityProfileCard
          catalogV9Enabled
          profile={{
            movementLevel: "none",
            availableResources: [],
            excludedTaskIds: [],
            defaultDurationMinutes: 5,
            onboardingCompleted: false,
            revision: 0,
          }}
          saving={false}
          onSave={onSave}
        />,
      ),
    );

    act(() => findButton(container, "Могу выполнять любые упражнения").click());
    expect(findButton(container, "Отжимания").disabled).toBe(true);
    act(() => findButton(container, "Можно активные упражнения").click());
    expect(findButton(container, "Отжимания").disabled).toBe(false);
    act(() => findButton(container, "Можно умыться").click());
    await act(async () => findButton(container, "Сохранить возможности").click());

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        availableResources: expect.arrayContaining(["active_movement", "wash_access"]),
        onboardingCompleted: true,
      }),
    );
  });

  it("показывает заполненную анкету компактно до нажатия редактирования", () => {
    act(() =>
      root.render(
        <CapabilityProfileCard
          profile={{
            movementLevel: "light",
            availableResources: ["water", "bright_light"],
            excludedTaskIds: [],
            defaultDurationMinutes: 5,
            onboardingCompleted: true,
            revision: 2,
          }}
          saving={false}
          onSave={async () => undefined}
        />,
      ),
    );
    expect(container.textContent).toContain("доступно ресурсов: 2");
    expect(container.querySelector('select[aria-label="Допустимое движение"]')).toBeNull();
    act(() => findButton(container, "Изменить").click());
    expect(container.querySelector('select[aria-label="Допустимое движение"]')).toBeNull();
    expect(findButton(container, "Только лёгкое движение").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(container.textContent).toContain("Пройтись");
    expect(container.textContent).toContain("Мягкая разминка");
    expect(container.textContent).not.toContain("Пять спокойных повторений");
    expect(container.textContent).toContain("Яркий свет");
    expect(container.textContent).not.toContain("Шторы");
  });

  it("показывает Пикса только как необязательного проводника первой настройки", () => {
    const profile = {
      movementLevel: "light" as const,
      availableResources: ["water" as const],
      excludedTaskIds: [],
      defaultDurationMinutes: 5 as const,
      onboardingCompleted: false,
      revision: 0,
    };

    act(() =>
      root.render(
        <CapabilityOnboardingScreen
          profile={profile}
          saving={false}
          onSave={async () => undefined}
          onCompleted={() => undefined}
          showPix
        />,
      ),
    );
    expect(container.querySelector('[data-testid="pix-avatar"]')).not.toBeNull();
    expect(container.textContent).toContain("Поможет настроить безопасное пробуждение");

    act(() =>
      root.render(
        <CapabilityOnboardingScreen
          profile={profile}
          saving={false}
          onSave={async () => undefined}
          onCompleted={() => undefined}
        />,
      ),
    );
    expect(container.querySelector('[data-testid="pix-avatar"]')).toBeNull();
  });
});
