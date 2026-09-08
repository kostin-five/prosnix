import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WakeProfileSummary } from "../src/features/analytics/wake-profile-summary.js";
import type { AnalyticsProfileResponse } from "../src/shared/api/client.js";

const profile: AnalyticsProfileResponse = {
  methodVersion: "analytics-v2",
  computedAt: "2026-09-08T00:00:00.000Z",
  averageDelta: {
    key: "average-delta",
    value: 1.2,
    evidenceCount: 13,
    evidenceIds: [],
    confidence: "high",
  },
  riseSuccess: {
    key: "rise-success",
    value: 0.85,
    evidenceCount: 13,
    evidenceIds: [],
    confidence: "high",
  },
  protocolEffects: [],
  factorEffects: [],
  comparisonProgress: [
    {
      key: "factor:movement:movement-a:night_sleep:5m",
      factorKey: "movement",
      groupKey: "movement-a:night_sleep:5m",
      withCount: 2,
      withoutCount: 1,
      pairCount: 1,
      targetPairs: 3,
      status: "collecting",
    },
  ],
  sequenceEffects: [],
};

describe("профиль пробуждения", () => {
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

  it("показывает содержательный профиль при 13 сессиях без готового factor effect", () => {
    act(() => root.render(<WakeProfileSummary profile={profile} evidenceCount={13} />));

    expect(container.textContent).toContain("Типичный прирост");
    expect(container.textContent).toContain("+1.2");
    expect(container.textContent).toContain("Подъём сохранился");
    expect(container.textContent).toContain("85%");
    expect(container.textContent).toContain("13 завершённых сессий");
    expect(container.textContent).toContain("Сопоставимых пар: 1/3");
    expect(container.textContent).toContain("С движением 2, без — 1");
  });
});
