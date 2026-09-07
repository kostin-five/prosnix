import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminScreen, type AdminGrowthData } from "../src/features/admin/admin-screen.js";

const summary: AdminGrowthData = {
  period: { days: 7, from: "2026-08-29T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
  computedAt: "2026-09-05T00:00:00.000Z",
  users: { total: 20, new: 5, active: 8 },
  sessions: { started: 10, completed: 8, abandoned: 1, completionRate: 0.8 },
  funnel: {
    assigned: 12,
    started: 10,
    completed: 8,
    followedUp: 6,
    startRate: 0.8333,
    completionRate: 0.8,
    followUpRate: 0.75,
  },
  wakeQuality: { pairedSessions: 8, averageDelta: 2.25, improvedSessions: 7, improvedRate: 0.875 },
  followUp: {
    eligible: 8,
    answered: 6,
    responseRate: 0.75,
    up: 5,
    back: 1,
    drowsy: 0,
    stayedUpRate: 0.8333,
  },
  retention: {
    d1: { eligible: 10, retained: 4, rate: 0.4 },
    d7: { eligible: 6, retained: 2, rate: 0.3333 },
  },
  timeline: [
    { date: "2026-09-04", newUsers: 2, startedSessions: 4, completedSessions: 3 },
    { date: "2026-09-05", newUsers: 0, startedSessions: 0, completedSessions: 0 },
  ],
  breakdowns: {
    contexts: [{ key: "night_sleep", sessions: 7, completed: 6, completionRate: 0.8571 }],
    durations: [{ minutes: 5, sessions: 8, completed: 7, completionRate: 0.875 }],
  },
  features: {
    capabilityProfiles: 6,
    routinesEnabled: 3,
    routineRuns: 5,
    routineRunsCompleted: 4,
    aiInsightsGenerated: 4,
  },
  deliveries: {
    dailySent: 6,
    followUpSent: 5,
    failed: 1,
    blocked: 0,
    terminal: 12,
    successRate: 0.9167,
  },
  billing: { enabled: false, activeSubscriptions: 0, grossStars: 0 },
};

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("admin dashboard", () => {
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

  it("показывает воронку, качество и эксплуатационные метрики с пояснениями", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(summary), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    act(() => root.render(<AdminScreen />));
    await settle();

    expect(container.textContent).toContain("Воронка пробуждения");
    expect(container.textContent).toContain("Средний прирост");
    expect(container.textContent).toContain("+2.25");
    expect(container.textContent).toContain("8 парных сессий");
    expect(container.textContent).toContain("Успешность доставки");
    expect(container.textContent).toContain("92%");
    expect(container.textContent).toContain("Ночной сон");
  });

  it("повторяет запрос после ошибки", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "internal_error", requestId: "safe-request-42" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(summary), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    act(() => root.render(<AdminScreen />));
    await settle();
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Повторить",
    );
    expect(retry).toBeDefined();
    expect(container.textContent).toContain("Код запроса: safe-request-42");
    act(() => retry!.click());
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Воронка пробуждения");
  });

  it("переключает период и запрашивает новую когортную сводку", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(summary), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    act(() => root.render(<AdminScreen />));
    await settle();

    const period = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "30 дней",
    );
    expect(period).toBeDefined();
    act(() => period!.click());
    await settle();

    expect(fetch).toHaveBeenLastCalledWith("/api/v1/admin/growth?days=30", {
      credentials: "same-origin",
    });
    expect(period?.getAttribute("aria-pressed")).toBe("true");
  });

  it("объясняет пустой период и сохраняет безопасные нулевые показатели", async () => {
    const emptySummary: AdminGrowthData = {
      ...summary,
      users: { total: 20, new: 0, active: 0 },
      sessions: { started: 0, completed: 0, abandoned: 0, completionRate: 0 },
      funnel: {
        assigned: 0,
        started: 0,
        completed: 0,
        followedUp: 0,
        startRate: 0,
        completionRate: 0,
        followUpRate: 0,
      },
      wakeQuality: { pairedSessions: 0, averageDelta: null, improvedSessions: 0, improvedRate: 0 },
      followUp: {
        eligible: 0,
        answered: 0,
        responseRate: 0,
        up: 0,
        back: 0,
        drowsy: 0,
        stayedUpRate: 0,
      },
      timeline: summary.timeline.map((point) => ({
        ...point,
        newUsers: 0,
        startedSessions: 0,
        completedSessions: 0,
      })),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(emptySummary), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    act(() => root.render(<AdminScreen />));
    await settle();

    expect(container.textContent).toContain("За этот период пока нет активности");
    expect(container.textContent).toContain("Нет данных");
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });
});
