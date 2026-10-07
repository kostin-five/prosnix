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
      wakeProfile: {
        movementLevel: "full",
        availableResources: ["water", "bright_light", "floor_space"],
        excludedTaskIds: [],
        defaultDurationMinutes: 5,
        onboardingCompleted: true,
        revision: 1,
      },
    }),
  );
  await page.route("**/api/v1/experiment-feedback", (route) =>
    json(route, { eligible: false, submitted: false }),
  );
  await page.route("**/api/v1/pro-interest", (route) =>
    json(route, { eligible: false, submitted: false }),
  );
}

test("следующий шаг виден при загрузке и до первого пробуждения", async ({ page }) => {
  await openTelegramApp(page);
  let analyticsRequests = 0;
  let historyRequests = 0;
  let releaseProfile = () => undefined;
  const heldProfile = new Promise<void>((resolve) => {
    releaseProfile = resolve;
  });
  await page.route("**/api/v1/analytics/profile", async (route) => {
    analyticsRequests += 1;
    await heldProfile;
    await json(route, {
      methodVersion: "analytics-v2",
      computedAt: "2026-09-27T06:00:00.000Z",
      averageDelta: {
        key: "average-delta",
        value: null,
        evidenceCount: 0,
        evidenceIds: [],
        confidence: "insufficient",
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
    });
  });
  await page.route("**/api/v1/sessions/history?limit=10", (route) => {
    historyRequests += 1;
    return json(route, { sessions: [] });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Статистика" }).click();
  await expect(page.getByRole("heading", { name: "Следующий шаг" })).toBeVisible();
  await expect(page.getByText(/Проверяем сохранённые пробуждения/)).toBeVisible();
  await expect(page.getByText("0/7", { exact: false })).toHaveCount(0);
  releaseProfile();
  await expect(page.getByText(/После следующего сна выбери короткий протокол/)).toBeVisible();
  await expect(page.getByText("0 из 7 до первого общего профиля")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 500 });
  const requestsBeforeSwitch = { analyticsRequests, historyRequests };
  await page.locator(".ps-stats").evaluate((element) => {
    element.setAttribute("data-retained-screen", "true");
    element.scrollTop = 120;
  });
  await expect
    .poll(() => page.locator(".ps-stats").evaluate((element) => element.scrollTop))
    .toBe(120);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(page.locator(".ps-stats")).toBeHidden();
  await page.getByRole("button", { name: "Статистика", exact: true }).click();
  await expect(page.locator(".ps-stats")).toHaveAttribute("data-retained-screen", "true");
  await expect(page.getByText("0 из 7 до первого общего профиля")).toBeVisible();
  expect({ analyticsRequests, historyRequests }).toEqual(requestsBeforeSwitch);
  expect(await page.locator(".ps-stats").evaluate((element) => element.scrollTop)).toBe(120);
});

test("после третьего пробуждения отчёт создаётся по нажатию", async ({ page }) => {
  await openTelegramApp(page);
  await page.route("**/api/v1/analytics/profile", (route) =>
    json(route, {
      methodVersion: "analytics-v2",
      computedAt: "2026-09-27T06:00:00.000Z",
      averageDelta: {
        key: "average-delta",
        value: 2,
        evidenceCount: 3,
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
  let requests = 0;
  await page.route("**/api/v1/coach/insight", (route) => {
    requests += 1;
    return json(route, {
      status: "ready",
      evidenceCount: 3,
      cached: false,
      source: "provider",
      limitReached: true,
      refreshAvailableAt: "2026-09-28T00:00:00.000Z",
      insight: {
        summary: "Первые наблюдения сохранены.",
        nextExperiment: "Повтори протокол в похожих условиях.",
        caveat: "Три сессии дают только предварительный вывод.",
        confidence: "low",
        generatedAt: "2026-09-27T06:00:00.000Z",
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Статистика" }).click();
  const createReport = page.getByRole("button", { name: "Создать персональный отчёт" });
  await expect(createReport).toBeVisible();
  expect(requests).toBe(0);
  await createReport.click();
  await expect(page.getByText("Первые наблюдения сохранены.")).toBeVisible();
  expect(requests).toBe(1);
});

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
  await expect(page.getByLabel("Prosnix", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Прирост бодрости по дням")).toHaveCount(0);
  await expect(page.getByText("Пробуждений", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Статистика" }).click();

  await expect(page.locator(".ps-stats-hero")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Прогресс до первого профиля" }),
  ).toHaveAttribute("aria-valuenow", "6");
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await expect(page.getByText("+3.5", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("60%", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1м", { exact: true })).toBeVisible();
  await expect(page.getByText("Как проходит пробуждение")).toBeVisible();
  await expect(page.getByText(/заметно выше/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Следующий шаг" })).toBeVisible();
  await expect(page.getByText(/В следующий раз выбери тот же контекст сна/)).toBeVisible();
  await expect(page.getByText(/До первого профиля осталось 1/)).toBeVisible();
  await expect(page.getByText(/Это рабочая проверка, а не доказанный лучший способ/)).toBeVisible();
  await expect(page.getByText("Средний прирост по датам")).toHaveCount(0);
  await page.getByLabel("Открыть эксперимент 1").click();
  await expect(page.getByText("Что было в эксперименте")).toBeVisible();
  await expect(page.getByText("Бодрость: 3 → 7")).toBeVisible();
  await expect(page.getByText("Длительность: 1 мин")).toBeVisible();
  await expect(page.getByText("Через 15 минут: встал")).toBeVisible();
  await expect(page.getByText("Справка об аналитике")).toHaveCount(0);
  await expect(page.getByText(/Сессия s1/)).toHaveCount(0);
  await expect(page.getByText("Персональный отчёт", { exact: true })).toBeVisible();
  await expect(page.getByText(/один новый бесплатный отчёт в день/)).toBeVisible();
  expect(coachRequests).toBe(0);
  await page.getByRole("button", { name: "Создать персональный отчёт" }).click();
  await expect(page.getByText("Главный вывод")).toBeVisible();
  await expect(page.getByText("Высокая уверенность")).toHaveCount(0);
  await expect(page.getByText(/Движение даёт наиболее устойчивый/)).toBeVisible();
  expect(coachRequests).toBe(1);
});

test("после 13 сессий общий профиль не зависит от готовности факторных пар", async ({ page }) => {
  await openTelegramApp(page);
  await page.route("**/api/v1/analytics/profile", (route) =>
    json(route, {
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
      sequenceEffects: [
        {
          key: "sequence:steps>reaction>memory",
          value: 2.5,
          evidenceCount: 2,
          evidenceIds: [],
          confidence: "insufficient",
        },
      ],
      dailyTrend: [],
    }),
  );
  await page.route("**/api/v1/sessions/history?limit=10", (route) =>
    json(route, {
      sessions: [
        {
          id: "history-2",
          completedAt: "2026-09-08T06:00:00.000Z",
          baseline: 5,
          postRating: 4,
          durationMs: 60_000,
          followUp: "drowsy",
          tasks: [],
          wakeContext: "night_sleep",
          durationMinutes: 5,
        },
        {
          id: "history-1",
          completedAt: "2026-09-07T06:00:00.000Z",
          baseline: 3,
          postRating: 6,
          durationMs: 60_000,
          followUp: "up",
          tasks: [],
          wakeContext: "night_sleep",
          durationMinutes: 5,
        },
      ],
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Статистика" }).click();
  await expect(page.getByText(/Основано на 13 завершённых сессиях/)).toBeVisible();
  await expect(page.getByText("Как проходит пробуждение")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Следующий шаг" })).toHaveCount(1);
  await expect(page.getByText("Что попробовать дальше")).toHaveCount(0);
  await expect(page.getByText("Что Prosnix ещё проверяет")).toBeVisible();
  await expect(page.getByRole("img", { name: "Эффект 2 последних пробуждений" })).toBeVisible();
  await expect(page.getByText("Высокая уверенность")).toHaveCount(0);
  await expect(page.getByText(/Профиль готов по/)).toHaveCount(0);
  await expect(page.getByText(/Проверь порядок «Пройтись → Реакция → Память»/)).toBeVisible();
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

test("до третьего пробуждения отчёт недоступен и header помещается на 320 px", async ({ page }) => {
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
  await page.route("**/api/v1/coach/insight", async (route) => {
    endpointRequests += 1;
    return json(route, { status: "unavailable", evidenceCount: 2, insight: null });
  });

  await page.goto("/");
  await expect(page.getByLabel("Prosnix", { exact: true })).toBeVisible();
  const brand = await page.getByLabel("Prosnix", { exact: true }).boundingBox();
  expect(brand).not.toBeNull();
  expect(brand!.x + brand!.width).toBeLessThanOrEqual(320);
  await expect(page.getByLabel("Завершено сессий: 2")).toHaveCount(0);

  await page.getByRole("button", { name: "Статистика" }).click();
  await expect(page.getByText(/Пока мало данных для персонального отчёта: 2\/3/)).toBeVisible();
  await expect(page.getByText("До отчёта осталось 1.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать персональный отчёт" })).toHaveCount(0);
  expect(endpointRequests).toBe(0);
});
