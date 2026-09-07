import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProsnixBrand } from "../src/features/brand/prosnix-brand.js";
import { PrivacyPolicy } from "../src/features/legal/privacy-policy.js";
import { TermsOfUse } from "../src/features/legal/terms-of-use.js";

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

  it("показывает актуального оператора и отдельный контакт поддержки", () => {
    act(() => root.render(<PrivacyPolicy />));
    expect(container.textContent).toContain("разработчик разработчик Денисович");
    expect(container.textContent).toContain("@prosnix_support");
    expect(container.querySelector('a[href="https://t.me/prosnix_support"]')).not.toBeNull();

    act(() => root.render(<TermsOfUse />));
    expect(container.textContent).toContain("разработчик разработчик Денисович");
    expect(container.textContent).toContain("@prosnix_support");
  });
});
