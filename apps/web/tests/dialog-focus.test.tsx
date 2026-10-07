import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ProtocolSheet } from "../src/features/tasks/protocol-sheet.js";

it("traps keyboard focus, handles Escape and restores the trigger", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const trigger = document.createElement("button");
  const container = document.createElement("div");
  document.body.append(trigger, container);
  trigger.focus();
  const root = createRoot(container),
    close = vi.fn();
  try {
    act(() =>
      root.render(
        <ProtocolSheet steps={[]} currentIndex={0} onClose={close} onAwakened={() => undefined} />,
      ),
    );
    const buttons = [...container.querySelectorAll("button")];
    expect(document.activeElement).toBe(buttons[0]);
    buttons.at(-1)!.focus();
    act(() =>
      buttons
        .at(-1)!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
        ),
    );
    expect(document.activeElement).toBe(buttons[0]);
    act(() =>
      buttons[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    expect(close).toHaveBeenCalledOnce();
    act(() => root.unmount());
    expect(document.activeElement).toBe(trigger);
  } finally {
    trigger.remove();
    container.remove();
  }
});
