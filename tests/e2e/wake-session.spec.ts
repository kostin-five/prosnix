import { expect, test, type Page, type Route } from "@playwright/test";

const baseSession = {
  id: "00000000-0000-4000-8000-000000000100",
  userId: "00000000-0000-4000-8000-000000000042",
  assignment: {
    id: "00000000-0000-4000-8000-000000000101",
    protocolKey: "e2e-light",
    protocolVersion: 1,
    strategyVersion: "e2e-v1",
    phase: "learning",
    hypothesis: "Проверяем полный путь сохранения",
    steps: [{ index: 0, taskId: "window", category: "environment" }],
  },
  status: "assigned",
  currentStepIndex: 0,
  version: 1,
  wakeContext: "night_sleep",
  durationMinutes: 5,
  personalization: {
    profileRevision: 0,
    movementLevel: "none",
    availableResources: [],
    excludedTaskIds: [],
    fallbackReason: "profile_missing",
  },
  baseline: null,
  tasks: [],
  postRating: null,
  followUp: null,
  startedAt: null,
  protocolCompletedAt: null,
  followUpDueAt: null,
  abandonedAt: null,
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installTelegram(page: Page) {
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
}

test("полный wake-up цикл подтверждается сервером до показа успеха", async ({ page }) => {
  await installTelegram(page);
  await page.clock.install();
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
      user: { id: baseSession.userId, locale: "ru", timezone: "Europe/Moscow" },
      activeSession: null,
      dueFollowUpSessionId: null,
      wakeSchedule: null,
      wakeProfile: {
        movementLevel: "none",
        availableResources: [],
        excludedTaskIds: [],
        defaultDurationMinutes: 5,
        onboardingCompleted: true,
        revision: 1,
      },
      wakeRoutine: { enabled: false, items: [], revision: 0 },
    }),
  );
  await page.route("**/api/v1/me/life-goal", (route) =>
    json(route, { text: "Построить своё дело", revision: 1 }),
  );
  await page.route("**/api/v1/sessions", async (route, request) => {
    expect(request.headers()["idempotency-key"]).toBeTruthy();
    await json(route, baseSession, 201);
  });
  await page.route("**/api/v1/sessions/*/baseline", async (route, request) => {
    expect(request.headers()["if-match"]).toBe("1");
    await json(route, { ...baseSession, status: "in_progress", version: 2, baseline: 3 });
  });
  const task = {
    stepIndex: 0,
    taskId: "window",
    category: "environment",
    correct: 1,
    total: 1,
    durationMs: 500,
    observedAt: "2026-08-28T06:00:00.000Z",
  };
  await page.route("**/api/v1/sessions/*/steps/0", async (route, request) => {
    expect(request.headers()["if-match"]).toBe("2");
    await json(route, {
      ...baseSession,
      status: "in_progress",
      version: 3,
      baseline: 3,
      currentStepIndex: 1,
      tasks: [task],
    });
  });
  await page.route("**/api/v1/sessions/*/post-rating", async (route, request) => {
    expect(request.headers()["if-match"]).toBe("3");
    await json(route, {
      ...baseSession,
      status: "protocol_completed",
      version: 4,
      baseline: 3,
      currentStepIndex: 1,
      tasks: [task],
      postRating: 7,
      protocolCompletedAt: "2026-08-28T06:01:00.000Z",
      followUpDueAt: "2026-08-28T06:16:00.000Z",
    });
  });
  await page.route("**/api/v1/sessions/*/follow-up", (route) =>
    json(route, {
      ...baseSession,
      status: "protocol_completed",
      version: 5,
      baseline: 3,
      currentStepIndex: 1,
      tasks: [task],
      postRating: 7,
      followUp: "up",
    }),
  );
  await page.route("**/api/v1/analytics/profile", (route) =>
    json(route, {
      methodVersion: "analytics-v2",
      computedAt: "2026-09-08T06:01:00.000Z",
      averageDelta: {
        key: "average-delta",
        value: 4,
        evidenceCount: 1,
        evidenceIds: [],
        confidence: "high",
      },
      riseSuccess: {
        key: "rise-success",
        value: 0.8,
        evidenceCount: 10,
        evidenceIds: [],
        confidence: "medium",
      },
      protocolEffects: [],
      factorEffects: [],
      sequenceEffects: [],
      dailyTrend: [],
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  const contextStartButton = page.getByRole("button", { name: "Начать пробуждение" });
  const contextLayout = await contextStartButton.evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    height: window.innerHeight,
    scrollY: window.scrollY,
  }));
  expect(contextLayout.scrollY).toBe(0);
  expect(contextLayout.bottom).toBeLessThanOrEqual(contextLayout.height);
  await page.getByRole("button", { name: "После ночного сна" }).click();
  await page.getByRole("button", { name: "5 мин" }).click();
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  await expect(page.getByText("Построить своё дело")).toBeVisible();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Начать протокол →" }).click();
  await expect(page.getByRole("heading", { name: "Яркий свет" })).toBeVisible();
  const headerAlignment = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const protocol = buttons.find((button) => button.textContent?.trim() === "Протокол");
    const sound = buttons.find((button) => button.getAttribute("aria-label") === "Включить звук");
    return {
      protocolCenter: protocol
        ? protocol.getBoundingClientRect().top + protocol.getBoundingClientRect().height / 2
        : undefined,
      soundCenter: sound
        ? sound.getBoundingClientRect().top + sound.getBoundingClientRect().height / 2
        : undefined,
      shellHeight: document
        .querySelector('[data-testid="task-experience-shell"]')
        ?.getBoundingClientRect().height,
    };
  });
  expect(headerAlignment.protocolCenter).toBeDefined();
  expect(headerAlignment.soundCenter).toBe(headerAlignment.protocolCenter);
  expect(headerAlignment.shellHeight).toBeLessThan(550);
  const taskLayout = await page
    .getByRole("button", { name: "Начать", exact: true })
    .evaluate((button) => {
      const screen = document.scrollingElement;
      const taskScreen = document.querySelector(
        '[data-testid="task-experience-shell"]',
      )?.parentElement;
      return {
        buttonBottom: button.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
        pageScrollHeight: screen?.scrollHeight ?? 0,
        taskScrollHeight: taskScreen?.scrollHeight ?? 0,
        taskClientHeight: taskScreen?.clientHeight ?? 0,
      };
    });
  expect(taskLayout.buttonBottom).toBeLessThanOrEqual(taskLayout.viewportHeight);
  expect(taskLayout.pageScrollHeight).toBeLessThanOrEqual(taskLayout.viewportHeight);
  expect(taskLayout.taskScrollHeight).toBeLessThanOrEqual(taskLayout.taskClientHeight);
  await page.addStyleTag({ content: "html { font-size: 24px !important; }" });
  await page.getByRole("button", { name: "Начать", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Начать", exact: true })).toBeInViewport();
  await expect(page.locator('[data-task-motion="window"]')).toBeVisible();
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await expect(page.getByRole("timer", { name: "Осталось 30 секунд" })).toBeVisible();
  expect(
    await page
      .getByRole("button", { name: "Поставить таймер на паузу" })
      .evaluate((button) => getComputedStyle(button).backgroundImage),
  ).toBe("none");
  await expect(page.locator('[data-testid="task-timer-light"]')).toBeVisible();
  await page.clock.runFor(31_000);
  await expect(page.getByRole("timer", { name: "Таймер завершён" })).toBeVisible();
  await page.getByRole("button", { name: "Готово" }).click();
  await page.getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить результат" }).click();
  await expect(page.getByRole("heading", { name: "Протокол завершён" })).toBeVisible();
  await expect(page.getByText("Пикс", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Ещё 6 пробуждений/)).toBeVisible();
  await expect(page.getByText("Вечером проверь настройки")).toBeVisible();
  await expect(page.getByText(/дополнительного утреннего уведомления не будет/)).toBeVisible();
  await page.getByRole("button", { name: "Ответить сейчас" }).click();
  await page.getByRole("button", { name: /Да, уже встал/ }).click();
  await expect(page.getByText("Встал и не лёг обратно")).toBeVisible();
  await expect(page.getByText("Ответ сохранён и учтён в профиле пробуждения")).toBeVisible();
});

test("сохранённая version 10 показывает шесть шагов и длинный таймер", async ({ page }) => {
  await installTelegram(page);
  await page.clock.install();
  await page.route("**/api/v1/auth/telegram", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/legal/status", (route) =>
    json(route, {
      privacyVersion: "2026-08-31",
      termsVersion: "2026-08-31",
      accepted: true,
      acceptedAt: "2026-08-31T00:00:00.000Z",
    }),
  );
  const steps = ["water", "math", "memory", "stroop", "reaction", "window"].map(
    (taskId, index) => ({
      index,
      taskId,
      category:
        taskId === "water" ? "behavioral" : taskId === "window" ? "environment" : "cognitive",
    }),
  );
  await page.route("**/api/v1/bootstrap", (route) =>
    json(route, {
      user: { id: baseSession.userId, locale: "ru", timezone: "Europe/Moscow" },
      activeSession: {
        session: {
          id: baseSession.id,
          status: "in_progress",
          currentStepIndex: 0,
          version: 2,
          durationMinutes: 5,
        },
        protocol: { key: "compact-v10", version: 10, title: "Пятиминутный протокол", steps },
        assignment: {
          strategyVersion: "learning-v6",
          phase: "learning",
          hypothesis: "Пробуждение",
        },
        baseline: 3,
        postRating: null,
      },
      dueFollowUpSessionId: null,
      wakeProfile: {
        movementLevel: "none",
        availableResources: ["water"],
        excludedTaskIds: [],
        defaultDurationMinutes: 5,
        onboardingCompleted: true,
        revision: 1,
      },
      wakeRoutine: { enabled: false, items: [], revision: 0 },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByText("Шаг 1 из 6", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Стакан воды" })).toBeVisible();
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await expect(page.getByRole("timer", { name: "Осталось 25 секунд" })).toBeVisible();
  await page.clock.runFor(24_000);
  await expect(page.getByRole("button", { name: "Выпил" })).toBeDisabled();
  await page.clock.runFor(1_000);
  await expect(page.getByRole("button", { name: "Выпил" })).toBeEnabled();
});
