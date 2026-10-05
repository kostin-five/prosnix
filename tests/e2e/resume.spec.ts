import { expect, test } from "@playwright/test";

test("сохранённый режим без телефона продолжает неэкранный шаг", async ({ page }) => {
  await page.route("https://telegram.org/js/telegram-web-app.js*", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: { initData: "synthetic-test-data", ready: () => undefined, expand: () => undefined },
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
    route.fulfill({
      json: {
        user: {
          id: "00000000-0000-4000-8000-000000000042",
          locale: "ru",
          timezone: "Europe/Moscow",
        },
        activeSession: {
          session: {
            id: "00000000-0000-4000-8000-000000000100",
            status: "in_progress",
            currentStepIndex: 1,
            version: 3,
            durationMinutes: 2,
            wakeContext: "night_sleep",
            experience: { interactionMode: "hands_free", soundMode: "on" },
          },
          protocol: {
            key: "hands-free-v1",
            version: 11,
            title: "Без телефона",
            steps: [
              { index: 0, taskId: "notice_three", category: "behavioral" },
              { index: 1, taskId: "find_color", category: "environment" },
            ],
          },
          assignment: { strategyVersion: "hands-free-v1", phase: "fallback", hypothesis: "test" },
          baseline: 3,
          postRating: null,
        },
        dueFollowUpSessionId: null,
        wakeProfile: {
          movementLevel: "none",
          availableResources: [],
          excludedTaskIds: [],
          defaultDurationMinutes: 2,
          onboardingCompleted: true,
          revision: 1,
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByRole("heading", { name: "Найди цвет" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Приготовься: Найди цвет/ })).toBeVisible();
});

test("mobile user resumes from the next confirmed task", async ({ page }) => {
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
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", locale: "ru", timezone: "Europe/Moscow" },
        activeSession: {
          session: {
            id: "session-1",
            status: "in_progress",
            currentStepIndex: 1,
            version: 3,
          },
          protocol: {
            key: "learning-cognitive",
            version: 1,
            title: "Attention start",
            steps: [
              { index: 0, taskId: "math", category: "cognitive" },
              { index: 1, taskId: "memory", category: "cognitive" },
            ],
          },
          assignment: {
            strategyVersion: "learning-v1",
            phase: "learning",
            hypothesis: "Measure a cognitive baseline",
          },
          baseline: 3,
          postRating: null,
        },
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
    }),
  );

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Продолжить пробуждение?" })).toBeVisible();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByText("Шаг 2 из 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Память" })).toBeVisible();
  const digits = page.locator("[data-memory-digit]");
  await expect(digits.first()).toBeVisible();
  const offset = await digits.first().evaluate((first) => {
    const row = first.parentElement!.getBoundingClientRect();
    const left = first.getBoundingClientRect().left - row.left;
    const right = row.right - first.parentElement!.lastElementChild!.getBoundingClientRect().right;
    return Math.abs(left - right);
  });
  expect(offset).toBeLessThan(2);
});

test("пользователь может закрыть сохранённую сессию и вернуться на главную", async ({ page }) => {
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
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", locale: "ru", timezone: "Europe/Moscow" },
        activeSession: {
          session: { id: "session-1", status: "in_progress", currentStepIndex: 1, version: 3 },
          protocol: {
            key: "learning",
            version: 1,
            title: "Тест",
            steps: [{ index: 0, taskId: "math", category: "cognitive" }],
          },
          assignment: { strategyVersion: "learning-v1", phase: "learning", hypothesis: "Тест" },
          baseline: 3,
          postRating: null,
        },
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
    }),
  );
  await page.route("**/api/v1/sessions/session-1/abandon", async (route, request) => {
    expect(request.headers()["if-match"]).toBe("3");
    expect(request.headers()["idempotency-key"]).toBeTruthy();
    expect(request.headers()["content-type"]).toBeUndefined();
    expect(request.postData()).toBeNull();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "session-1", status: "abandoned", version: 4 }),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Закрыть сохранённую сессию" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть сохранённую сессию" }).click();
  await expect(page.getByRole("heading", { name: "Пора проснуться" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-telegram-closed", "true");
});

test("mobile user продолжает protocol v9 с таймером умывания", async ({ page }) => {
  await page.clock.install();
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
  const steps = [
    { index: 0, taskId: "cool_wash", category: "behavioral" },
    { index: 1, taskId: "sit_edge", category: "movement" },
    { index: 2, taskId: "shake", category: "movement" },
    { index: 3, taskId: "pushups", category: "movement" },
  ];
  await page.route("**/api/v1/bootstrap", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-v9", locale: "ru", timezone: "Europe/Moscow" },
        activeSession: {
          session: {
            id: "session-v9",
            status: "in_progress",
            currentStepIndex: 0,
            version: 3,
            wakeContext: "night_sleep",
            durationMinutes: 5,
            personalization: {
              profileRevision: 1,
              movementLevel: "full",
              availableResources: ["floor_space", "wash_access", "active_movement"],
              excludedTaskIds: [],
              fallbackReason: "none",
            },
          },
          protocol: { key: "catalog-v9", version: 9, title: "Тест v9", steps },
          assignment: { strategyVersion: "learning-v6", phase: "learning", hypothesis: "Тест v9" },
          baseline: 3,
          postRating: null,
        },
        dueFollowUpSessionId: null,
        wakeProfile: {
          movementLevel: "full",
          availableResources: ["floor_space", "wash_access", "active_movement"],
          excludedTaskIds: [],
          defaultDurationMinutes: 5,
          onboardingCompleted: true,
          revision: 1,
        },
      }),
    }),
  );
  await page.route("**/api/v1/sessions/session-v9/steps/0", async (route, request) => {
    expect(request.headers()["if-match"]).toBe("3");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "session-v9",
        userId: "user-v9",
        assignment: {
          id: "assignment-v9",
          protocolKey: "catalog-v9",
          protocolVersion: 9,
          strategyVersion: "learning-v6",
          phase: "learning",
          hypothesis: "Тест v9",
          steps,
        },
        status: "in_progress",
        currentStepIndex: 1,
        version: 4,
        wakeContext: "night_sleep",
        durationMinutes: 5,
        personalization: {
          profileRevision: 1,
          movementLevel: "full",
          availableResources: ["floor_space", "wash_access", "active_movement"],
          excludedTaskIds: [],
          fallbackReason: "none",
        },
        baseline: 3,
        tasks: [
          {
            stepIndex: 0,
            taskId: "cool_wash",
            category: "behavioral",
            correct: 1,
            total: 1,
            durationMs: 20_000,
            observedAt: "2026-09-23T06:00:20.000Z",
          },
        ],
        postRating: null,
        followUp: null,
        startedAt: "2026-09-23T06:00:00.000Z",
        protocolCompletedAt: null,
        followUpDueAt: null,
        abandonedAt: null,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByRole("heading", { name: "Умыться прохладной водой" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Начать", exact: true })).toHaveCount(0);
  await expect(page.getByRole("timer", { name: "Осталось 20 секунд" })).toBeVisible();
  await page.clock.runFor(20_000);
  await page.getByRole("button", { name: "Умылся" }).click();
  await page.clock.runFor(600);
  await expect(page.getByRole("heading", { name: "Сесть на край кровати" })).toBeVisible();
  await page.getByRole("button", { name: "Протокол" }).click();
  await expect(page.getByText("Отжимания", { exact: true })).toBeVisible();
});
