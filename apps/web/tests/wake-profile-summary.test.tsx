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
    {
      key: "factor:movement:movement-b:night_sleep:5m",
      factorKey: "movement",
      groupKey: "movement-b:night_sleep:5m",
      withCount: 1,
      withoutCount: 1,
      pairCount: 1,
      targetPairs: 3,
      status: "collecting",
    },
  ],
  sequenceEffects: [
    {
      key: "sequence:steps>reaction>memory",
      value: 2.5,
      evidenceCount: 2,
      evidenceIds: [],
      confidence: "insufficient",
    },
  ],
};

const recentSessions = [
  {
    id: "session-2",
    completedAt: "2026-09-08T06:00:00.000Z",
    baseline: 5,
    postRating: 4,
    followUp: "drowsy" as const,
    durationMs: 60_000,
    tasks: [],
    wakeContext: "night_sleep" as const,
    durationMinutes: 5 as const,
  },
  {
    id: "session-1",
    completedAt: "2026-09-07T06:00:00.000Z",
    baseline: 3,
    postRating: 6,
    followUp: "up" as const,
    durationMs: 60_000,
    tasks: [],
    wakeContext: "night_sleep" as const,
    durationMinutes: 5 as const,
  },
];

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
    act(() =>
      root.render(
        <WakeProfileSummary profile={profile} evidenceCount={13} recentSessions={recentSessions} />,
      ),
    );

    expect(container.textContent).toContain("Как проходит пробуждение");
    expect(container.textContent).toContain("небольшой подъём бодрости");
    expect(container.textContent).toContain("подъём сохраняется и через 15 минут");
    expect(container.textContent).toMatch(/13\s+завершённых сессиях/);
    expect(container.textContent).not.toContain("Высокая уверенность");
    expect(container.textContent).not.toContain("Что попробовать дальше");
    expect(container.querySelectorAll("details")).toHaveLength(1);
    expect(container.textContent?.match(/помогает ли движение/g)).toHaveLength(1);
    expect(container.querySelector('[aria-label="Эффект 2 последних пробуждений"]')).not.toBeNull();
    expect(container.textContent).toContain("+3");
    expect(container.textContent).toContain("-1");
  });

  it("показывает фактическую долю устойчивого подъёма", () => {
    act(() =>
      root.render(
        <WakeProfileSummary
          profile={{
            ...profile,
            riseSuccess: { ...profile.riseSuccess, value: 5 / 7, evidenceCount: 7 },
          }}
          evidenceCount={7}
          recentSessions={recentSessions}
        />,
      ),
    );

    expect(container.textContent).toContain("В 71% проверок подъём сохраняется");
    expect(container.textContent).not.toContain("Примерно в половине");
  });
});
