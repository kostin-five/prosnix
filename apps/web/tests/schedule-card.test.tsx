import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WakeScheduleCard } from "../src/features/schedule/wake-schedule-card.js";

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const result = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!result) throw new Error(`Button not found: ${label}`);
  return result;
}

describe("WakeScheduleCard", () => {
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
  });

  it("explains disabled reminders and saves an enabled time", async () => {
    const onSave = vi.fn(async () => undefined);
    act(() =>
      root.render(
        <WakeScheduleCard schedule={null} defaultTime="07:00" saving={false} onSave={onSave} />,
      ),
    );
    expect(container.textContent).toContain("Напоминание выключено");
    expect(container.textContent).toContain("не системный будильник");
    act(() => button(container, "Изменить").click());
    const toggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Включить Telegram-напоминание"]',
    );
    if (!toggle) throw new Error("Reminder toggle not found");
    act(() => toggle.click());
    act(() => button(container, "Сохранить").click());
    await settle();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ localTime: "07:00", enabled: true }),
    );
  });

  it("shows a recoverable blocked state", () => {
    act(() =>
      root.render(
        <WakeScheduleCard
          schedule={{
            localTime: "07:00",
            timezone: "Europe/Moscow",
            enabled: false,
            nextTriggerAt: null,
            botStatus: "blocked",
            revision: 2,
          }}
          defaultTime="07:00"
          saving={false}
          onSave={async () => undefined}
        />,
      ),
    );
    expect(container.textContent).toContain("нажми Start");
  });

  it("does not present an unverified bot as available", () => {
    act(() =>
      root.render(
        <WakeScheduleCard
          schedule={{
            localTime: "07:00",
            timezone: "Europe/Moscow",
            enabled: true,
            nextTriggerAt: "2026-08-30T04:00:00.000Z",
            botStatus: "unknown",
            revision: 1,
          }}
          defaultTime="07:00"
          saving={false}
          onSave={async () => undefined}
        />,
      ),
    );
    expect(container.textContent).toContain("Ещё не проверено");
  });
});
