import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecoveryOfferCard } from "../src/features/session/recovery-offer-card.js";

describe("предложение короткого дополнительного раунда", () => {
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
    vi.clearAllMocks();
  });

  it("объясняет ограничение и оставляет явный отказ", () => {
    const onStart = vi.fn();
    const onDecline = vi.fn();
    act(() => {
      root.render(<RecoveryOfferCard busy={false} onStart={onStart} onDecline={onDecline} />);
    });

    expect(container.textContent).toContain("Ещё до 90 секунд");
    expect(container.textContent).toContain("Основной результат уже сохранён");
    const buttons = [...container.querySelectorAll("button")];
    act(() => buttons.find((button) => button.textContent?.includes("короткий раунд"))?.click());
    act(() => buttons.find((button) => button.textContent?.includes("Завершить"))?.click());
    expect(onStart).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it("блокирует повторные действия, пока запрос выполняется", () => {
    act(() => {
      root.render(<RecoveryOfferCard busy onStart={() => undefined} onDecline={() => undefined} />);
    });

    expect(container.textContent).toContain("Готовим раунд");
    expect([...container.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
  });
});
