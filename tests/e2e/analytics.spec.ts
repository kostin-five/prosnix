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
  await page.route("**/api/v1/experiment-feedback", (route) =>
    json(route, { eligible: false, submitted: false }),
  );
  await page.route("**/api/v1/pro-interest", (route) =>
    json(route, { eligible: false, submitted: false }),
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
      sequenceEffects: [
        {
          key: "sequence:water>memory",
          value: 4.5,
          evidenceCount: 2,
          evidenceIds: ["s1", "s2"],
          confidence: "insufficient",
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
  await expect(page.getByLabel("Prosnix Beta")).toBeVisible();
  await expect(page.getByLabel("Прирост бодрости по дням")).toHaveCount(0);
  await expect(page.getByText("Средний прирост")).toBeVisible();
  await page.getByRole("button", { name: "Статистика" }).click();

  await expect(page.getByText("+3.5", { exact: true })).toBeVisible();
  await expect(page.getByText("60%", { exact: true })).toBeVisible();
  await expect(page.getByText("1м", { exact: true })).toBeVisible();
  await expect(page.getByText("Движение", { exact: true })).toBeVisible();
  await expect(page.getByText("Низкая уверенность · 3 парных сравнения")).toBeVisible();
  await expect(page.getByText("Стакан воды → Память")).toBeVisible();
  await expect(page.getByText("Недостаточно данных · n=2")).toBeVisible();
  await expect(page.getByText("Средний прирост по датам")).toHaveCount(0);
  await page.getByLabel("Открыть эксперимент 1").click();
  await expect(page.getByText("Что было в эксперименте")).toBeVisible();
  await expect(page.getByText("Бодрость: 3 → 7")).toBeVisible();
  await expect(page.getByText("Длительность: 1 мин")).toBeVisible();
  await expect(page.getByText("Через 15 минут: встал")).toBeVisible();
  await page.getByText("Справка об аналитике").click();
  await expect(page.getByText(/Прирост — разница оценок после/)).toBeVisible();
  await expect(page.getByText(/Сессия s1/)).toHaveCount(0);
  await expect(page.getByText("Персональный отчёт", { exact: true })).toBeVisible();
  await expect(page.getByText(/один новый бесплатный отчёт в день/)).toBeVisible();
  expect(coachRequests).toBe(0);
  await page.getByRole("button", { name: "Создать персональный отчёт" }).click();
  await expect(page.getByText(/Движение даёт наиболее устойчивый/)).toBeVisible();
  expect(coachRequests).toBe(1);
});

test("после пяти сессий feedback показывается один раз и отправляется без влияния на wake flow", async ({
  page,
}) => {
  await openTelegramApp(page);
  await page.route("**/api/v1/analytics/profile", (route) =>
    json(route, {
      methodVersion: "analytics-v1",
      computedAt: "2026-09-07T06:00:00.000Z",
      averageDelta: {
        key: "average-delta",
        value: 2,
        evidenceCount: 5,
        evidenceIds: ["s1", "s2", "s3", "s4", "s5"],
        confidence: "low",
      },
      riseSuccess: {
        key: "rise-success",
        value: null,
        evidenceCount: 0,
        evidenceIds: [],
        confidence: "insufficient",
      },
      protocolEffects: [],
      factorEffects: [],
      sequenceEffects: [],
      dailyTrend: [],
    }),
  );
  await page.route("**/api/v1/sessions/history?limit=10", (route) => json(route, { sessions: [] }));
  let submitted = false;
  await page.route("**/api/v1/experiment-feedback", async (route) => {
    if (route.request().method() === "GET") return json(route, { eligible: true, submitted });
    expect(route.request().postDataJSON()).toEqual({
      helpful: 5,
      irritating: 1,
      continueIntent: 5,
    });
    submitted = true;
    return json(route, { eligible: true, submitted });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Статистика" }).click();
  await expect(page.getByText("Помоги улучшить эксперимент")).toBeVisible();
  await page.getByRole("radio", { name: "Насколько формат оказался полезен?: 5" }).click();
  await page.getByRole("radio", { name: "Насколько формат раздражал?: 1" }).click();
  await page.getByRole("radio", { name: "Хочешь продолжать эксперимент?: 5" }).click();
  await page.getByRole("button", { name: "Отправить ответы" }).click();
  await expect(page.getByText("Помоги улучшить эксперимент")).toHaveCount(0);
});

test("исследование Pro не запускает оплату и скрывается после одного ответа", async ({ page }) => {
  await openTelegramApp(page);
  await page.route("**/api/v1/analytics/profile", (route) =>
    json(route, {
      methodVersion: "analytics-v1",
      computedAt: "2026-09-07T12:00:00.000Z",
      averageDelta: {
        key: "average-delta",
        value: 2,
        evidenceCount: 7,
        evidenceIds: [],
        confidence: "low",
      },
      riseSuccess: {
        key: "rise-success",
        value: null,
        evidenceCount: 0,
        evidenceIds: [],
        confidence: "insufficient",
      },
      protocolEffects: [],
      factorEffects: [],
      sequenceEffects: [],
      dailyTrend: [],
    }),
  );
  await page.route("**/api/v1/sessions/history?limit=10", (route) => json(route, { sessions: [] }));
  let submitted = false;
  await page.route("**/api/v1/pro-interest", async (route) => {
    if (route.request().method() === "GET") return json(route, { eligible: true, submitted });
    expect(route.request().postDataJSON()).toEqual({ intent: "interested", interestFocus: "both" });
    submitted = true;
    return json(route, { eligible: true, submitted });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Статистика" }).click();
  await expect(page.getByText("Помоги выбрать, что развивать дальше")).toBeVisible();
  await expect(page.getByText(/Это не подписка: цены, оплаты и списания/)).toBeVisible();
  await expect(page.getByText(/Stars/)).toHaveCount(0);
  await page.getByRole("radio", { name: "Интересно", exact: true }).click();
  await page.getByRole("radio", { name: "Оба направления" }).click();
  await page.getByRole("button", { name: "Оставить ответ" }).click();
  await expect(page.getByText("Помоги выбрать, что развивать дальше")).toHaveCount(0);
});

test("ранний отчёт требует явного подтверждения и header помещается на 320 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openTelegramApp(page);
  await page.route("**/api/v1/analytics/profile", (route) =>
    json(route, {
      methodVersion: "analytics-v1",
      computedAt: "2026-09-06T08:00:00.000Z",
      averageDelta: {
        key: "average-delta",
        value: 1.5,
        evidenceCount: 2,
        evidenceIds: ["s1", "s2"],
        confidence: "insufficient",
      },
      riseSuccess: {
        key: "rise-success",
        value: 0.5,
        evidenceCount: 2,
        evidenceIds: ["s1", "s2"],
        confidence: "insufficient",
      },
      protocolEffects: [],
      factorEffects: [],
      sequenceEffects: [],
      dailyTrend: [
        { localDate: "2026-09-06", averageDelta: 1.5, evidenceCount: 2, sessionIds: ["s1", "s2"] },
      ],
    }),
  );
  await page.route("**/api/v1/sessions/history?limit=10", (route) => json(route, { sessions: [] }));
  let endpointRequests = 0;
  let confirmedRequests = 0;
  await page.route("**/api/v1/coach/insight", async (route) => {
    endpointRequests += 1;
    const body = route.request().postDataJSON() as { confirmEarly?: boolean };
    if (!body.confirmEarly) {
      return json(route, {
        status: "confirmation_required",
        evidenceCount: 2,
        cached: false,
        source: "fallback",
        limitReached: false,
        refreshAvailableAt: "2026-09-06T21:00:00.000Z",
        insight: null,
      });
    }
    confirmedRequests += 1;
    return json(route, {
      status: "ready",
      evidenceCount: 2,
      cached: false,
      source: "provider",
      limitReached: true,
      refreshAvailableAt: "2026-09-06T21:00:00.000Z",
      insight: {
        summary:
          "Результат пока меняется между сессиями, но проверка подъёма уже даёт первый сигнал.",
        nextExperiment: "Повтори назначенный протокол и ответь на проверку через 15 минут.",
        caveat: "Вывод предварительный и основан на двух сессиях.",
        confidence: "insufficient",
        generatedAt: "2026-09-06T08:00:00.000Z",
      },
    });
  });

  await page.goto("/");
  const brand = await page.getByLabel("Prosnix Beta").boundingBox();
  const counter = await page.getByLabel("Завершено сессий: 2").boundingBox();
  expect(brand).not.toBeNull();
  expect(counter).not.toBeNull();
  expect(brand!.x + brand!.width).toBeLessThanOrEqual(counter!.x);

  await page.getByRole("button", { name: "Статистика" }).click();
  await page.getByRole("button", { name: "Создать персональный отчёт" }).click();
  await expect(page.getByText("Пока мало данных для устойчивого вывода")).toBeVisible();
  expect(endpointRequests).toBe(1);
  expect(confirmedRequests).toBe(0);
  await page.getByRole("button", { name: "Создать всё равно" }).click();
  await expect(page.getByText("Что удалось заметить")).toBeVisible();
  expect(endpointRequests).toBe(2);
  expect(confirmedRequests).toBe(1);
});
