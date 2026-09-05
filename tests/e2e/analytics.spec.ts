import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function openTelegramApp(page: Page) {
  await page.route("https://telegram.org/js/telegram-web-app.js*", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: "signed-test-launch-data",
        ready: () => undefined,
        expand: () => undefined,
      },
    };
  });
  await page.route("**/api/v1/auth/telegram", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/legal/status", (route) =>
    route.fulfill({
      json: {
        privacyVersion: "2026-08-31",
        termsVersion: "2026-08-31",
        accepted: true,
        acceptedAt: "2026-08-31T00:00:00.000Z",
      },
    }),
  );
  await page.route("**/api/v1/bootstrap", (route) =>
    json(route, {
      user: { id: "user-1", locale: "ru", timezone: "Europe/Moscow" },
      activeSession: null,
      dueFollowUpSessionId: null,
    }),
  );
}

test("профиль показывает только воспроизводимые метрики смешанных протоколов", async ({ page }) => {
  await openTelegramApp(page);
  let coachRequests = 0;
  await page.route("**/api/v1/analytics/profile", (route) =>
    json(route, {
      methodVersion: "analytics-v1",
      computedAt: "2026-08-28T06:00:00.000Z",
      averageDelta: {
        key: "average-delta",
        value: 3.5,
        evidenceCount: 6,
        evidenceIds: ["s1", "s2", "s3", "s4", "s5", "s6"],
        confidence: "medium",
      },
      riseSuccess: {
        key: "rise-success",
        value: 0.6,
        evidenceCount: 5,
        evidenceIds: ["s1", "s2", "s3", "s4", "s5"],
        confidence: "low",
      },
      protocolEffects: [
        {
          key: "protocol:movement-with@1",
          value: 5,
          evidenceCount: 3,
          evidenceIds: ["s1", "s2", "s3"],
          confidence: "low",
        },
        {
          key: "protocol:movement-without@1",
          value: 2,
          evidenceCount: 3,
          evidenceIds: ["s4", "s5", "s6"],
          confidence: "low",
        },
      ],
      factorEffects: [
        {
          key: "factor:movement:movement-a",
          value: 3,
          evidenceCount: 3,
          evidenceIds: ["s1", "s2", "s3", "s4", "s5", "s6"],
          confidence: "low",
        },
      ],
      dailyTrend: [
        {
          localDate: "2026-08-31",
          averageDelta: 4,
          evidenceCount: 1,
          sessionIds: ["history-session-1"],
        },
      ],
    }),
  );
  await page.route("**/api/v1/coach/insight", (route) => {
    coachRequests += 1;
    return json(route, {
      status: "ready",
      evidenceCount: 6,
      cached: false,
      source: "provider",
      limitReached: true,
      refreshAvailableAt: "2026-09-01T21:00:00.000Z",
      insight: {
        summary: "Движение даёт наиболее устойчивый прирост бодрости.",
        nextExperiment: "Повторить протокол с движением и светом.",
        caveat: "Вывод предварительный: уверенность пока средняя.",
        confidence: "medium",
        generatedAt: "2026-08-31T09:00:00.000Z",
      },
    });
  });
  await page.route("**/api/v1/sessions/history?limit=10", (route) =>
    json(route, {
      sessions: [
        {
          id: "history-session-1",
          completedAt: "2026-08-31T06:00:00.000Z",
          baseline: 3,
          postRating: 7,
          durationMs: 60_000,
          followUp: "up",
          tasks: [{ taskId: "math", category: "cognitive" }],
        },
      ],
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Статистика" }).click();

  await expect(page.getByText("+3.5", { exact: true })).toBeVisible();
  await expect(page.getByText("60%", { exact: true })).toBeVisible();
  await expect(page.getByText("1м", { exact: true })).toBeVisible();
  await expect(page.getByText("Движение", { exact: true })).toBeVisible();
  await expect(page.getByText("Низкая уверенность · 3 парных сравнения")).toBeVisible();
  await expect(page.getByText("Разминка для мозга + движение")).toBeVisible();
  await expect(page.getByText(/Математика/).first()).toBeVisible();
  await expect(page.getByText("Средний прирост по датам")).toBeVisible();
  await expect(page.getByText("n=1")).toBeVisible();
  await page.getByLabel("Открыть эксперимент 1").click();
  await expect(page.getByText("Что было в эксперименте")).toBeVisible();
  await expect(page.getByText("Бодрость: 3 → 7")).toBeVisible();
  await expect(page.getByText("Длительность: 1 мин")).toBeVisible();
  await expect(page.getByText("Через 15 минут: встал")).toBeVisible();
  await page.getByText("Справка об аналитике").click();
  await expect(page.getByText(/Прирост — разница оценок после/)).toBeVisible();
  await expect(page.getByText(/Сессия s1/)).toHaveCount(0);
  await expect(page.getByText("AI-наставник")).toBeVisible();
  await expect(page.getByText(/один новый бесплатный разбор в день/)).toBeVisible();
  expect(coachRequests).toBe(0);
  await page.getByRole("button", { name: "Получить AI-разбор" }).click();
  await expect(page.getByText(/Движение даёт наиболее устойчивый/)).toBeVisible();
  expect(coachRequests).toBe(1);
});
