import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProCard } from "../src/features/billing/pro-card.js";
import { LegalGate } from "../src/features/legal/legal-gate.js";

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("production growth UI", () => {
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
    vi.restoreAllMocks();
  });

  it("requires an explicit legal confirmation", async () => {
    const accepted = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    act(() =>
      root.render(
        <LegalGate
          legal={{
            privacyVersion: "2026-08-31",
            termsVersion: "2026-08-31",
            accepted: false,
            acceptedAt: null,
          }}
          onAccepted={accepted}
        />,
      ),
    );
    const button = container.querySelector<HTMLButtonElement>("button")!;
    expect(button.disabled).toBe(true);
    act(() => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(button.disabled).toBe(false);
    act(() => button.click());
    await settle();
    expect(accepted).toHaveBeenCalledOnce();
  });

  it("does not offer a payment while billing is disabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          enabled: false,
          plan: { key: "pro-monthly-v1", priceStars: null, periodDays: 30 },
          entitlement: { status: "free", currentPeriodEnd: null },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    act(() => root.render(<ProCard />));
    await settle();
    expect(container.textContent).toContain("Платная версия ещё не включена");
    expect(container.querySelector("button")).toBeNull();
  });
});
