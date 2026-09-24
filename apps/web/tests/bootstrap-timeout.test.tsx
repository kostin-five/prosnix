import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  authenticateTelegram: vi.fn(),
  loadBootstrap: vi.fn(),
  loadLegalStatus: vi.fn(),
}));

vi.mock("../src/shared/api/client.js", () => api);
vi.mock("../src/telegram/bridge.js", () => ({
  getLaunchContext: () => ({ mode: "telegram", initData: "signed-init-data" }),
}));

import { BOOTSTRAP_TIMEOUT_MS, useBootstrap } from "../src/features/bootstrap/use-bootstrap.js";

function Probe() {
  const bootstrap = useBootstrap();
  if (bootstrap.status === "error") {
    return <p>{`${bootstrap.reason}: ${bootstrap.message}`}</p>;
  }
  return <p>{bootstrap.status}</p>;
}

describe("тайм-аут начальной загрузки", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    api.authenticateTelegram.mockImplementation(
      (_initData: string, signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Запрос отменён", "AbortError")),
            { once: true },
          );
        }),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("прекращает бесконечное ожидание и предлагает повторить позже", async () => {
    act(() => root.render(<Probe />));
    expect(container.textContent).toBe("loading");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOTSTRAP_TIMEOUT_MS);
    });

    expect(container.textContent).toContain("timeout");
    expect(container.textContent).toContain("Сервер запускается дольше обычного");
  });
});
