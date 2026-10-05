import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SettingsScreen from "../src/features/settings/settings-screen.js";

it("сохраняет паузу 5/10/20 секунд для пользователя и восстанавливает выбранную кнопку", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  let root = createRoot(container);
  const scope = "transition-settings-test";
  const screen = (
    <SettingsScreen
      alarmTime="08:00"
      schedule={null}
      saving={false}
      demo
      initialSection={null}
      onScheduleSave={vi.fn(async () => undefined)}
      wakeProfile={{
        movementLevel: "none",
        availableResources: [],
        excludedTaskIds: [],
        defaultDurationMinutes: 5,
        onboardingCompleted: true,
        revision: 0,
      }}
      wakeRoutine={{ enabled: false, items: [], revision: 0 }}
      personalizationSaving={false}
      onProfileSave={vi.fn(async () => undefined)}
      onRoutineSave={vi.fn(async () => undefined)}
      localStorageScope={scope}
      goalCalibrationEnabled={false}
    />
  );
  const click = (label: string) =>
    act(() =>
      [...container.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.includes(label))!
        .click(),
    );
  try {
    act(() => root.render(screen));
    click("Прохождение протокола");
    for (const seconds of [5, 10, 20]) {
      click(`${seconds} секунд`);
      expect(localStorage.getItem(`prosnix:${scope}:transition-pause`)).toBe(String(seconds));
    }
    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(screen));
    click("Прохождение протокола");
    expect(
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "20 секунд")
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(localStorage.getItem("prosnix:other-user:transition-pause")).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
    localStorage.removeItem(`prosnix:${scope}:transition-pause`);
  }
});
