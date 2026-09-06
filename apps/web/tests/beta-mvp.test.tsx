import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HomeWakeChart } from "../src/features/analytics/home-wake-chart.js";
import { ProsnixBrand } from "../src/features/brand/prosnix-brand.js";

describe("финальная Beta-полировка", () => {
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

  it("показывает фирменный wordmark и статус Beta", () => {
    act(() => root.render(<ProsnixBrand />));
    expect(container.querySelector("h1")?.textContent).toBe("PROSNIX");
    expect(container.textContent).toContain("Beta");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("показывает положительный, нулевой и отрицательный день со значением и n", () => {
    act(() =>
      root.render(
        <HomeWakeChart
          data={[
            { key: "a", label: "4 сент.", value: 2, evidenceCount: 2 },
            { key: "b", label: "5 сент.", value: 0, evidenceCount: 1 },
            { key: "c", label: "6 сент.", value: -1.5, evidenceCount: 3 },
          ]}
        />,
      ),
    );
    expect(container.textContent).toContain("+2.0");
    expect(container.textContent).toContain("+0.0");
    expect(container.textContent).toContain("-1.5");
    expect(container.textContent).toContain("n=3");
    expect(container.querySelectorAll("[style]")).toHaveLength(4);
  });

  it("показывает понятное пустое состояние", () => {
    act(() => root.render(<HomeWakeChart data={[]} />));
    expect(container.textContent).toContain("после первой полностью завершённой сессии");
  });
});
