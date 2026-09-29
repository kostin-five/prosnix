import { expect, test } from "@playwright/test";

test("режим без телефона сам завершает шаги, даёт подготовиться и открывает итоговую оценку", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/?demo=1");
  await page.getByRole("button", { name: "Попробовать пробуждение" }).click();
  await page.getByRole("button", { name: /Без телефона/ }).click();
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  await expect(page.getByText(/Без телефона ·/)).toBeVisible();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: /Начать протокол/ }).click();
  await expect(page.getByRole("heading", { name: "Три предмета" })).toBeVisible();
  await expect(page.getByRole("timer", { name: "Осталось 60 секунд" })).toBeVisible();

  await page.getByRole("button", { name: "Поставить таймер на паузу" }).click();
  await page.clock.runFor(3_000);
  await expect(page.getByRole("timer", { name: "Осталось 60 секунд" })).toBeVisible();
  await page.getByRole("button", { name: "Продолжить таймер" }).click();
  await page.clock.runFor(60_000);
  await expect(page.getByRole("heading", { name: "Найди цвет" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Приготовься: Найди цвет/ })).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(page.getByRole("timer", { name: "Осталось 60 секунд" })).toBeVisible();
  await page.clock.runFor(60_000);
  await expect(page.getByRole("heading", { name: "Как ты чувствуешь себя сейчас?" })).toBeVisible();
});

test("после ошибки сервера автопереход ждёт явного продолжения", async ({ page }) => {
  await page.clock.install();
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
        activeSession: null,
        dueFollowUpSessionId: null,
        wakeSchedule: null,
        wakeProfile: {
          movementLevel: "none",
          availableResources: [],
          excludedTaskIds: [],
          defaultDurationMinutes: 2,
          onboardingCompleted: true,
          revision: 1,
        },
        wakeRoutine: { enabled: false, items: [], revision: 0 },
      },
    }),
  );
  await page.route("**/api/v1/me/life-goal", (route) =>
    route.fulfill({ json: { text: null, revision: 0 } }),
  );
  const session = {
    id: "00000000-0000-4000-8000-000000000100",
    userId: "00000000-0000-4000-8000-000000000042",
    assignment: {
      id: "00000000-0000-4000-8000-000000000101",
      protocolKey: "hands-free-test",
      protocolVersion: 11,
      strategyVersion: "test",
      phase: "learning",
      hypothesis: "test",
      steps: [{ index: 0, taskId: "notice_three", category: "behavioral" }],
    },
    status: "assigned",
    currentStepIndex: 0,
    version: 1,
    wakeContext: "night_sleep",
    durationMinutes: 2,
    personalization: {
      profileRevision: 1,
      movementLevel: "none",
      availableResources: [],
      excludedTaskIds: [],
      fallbackReason: "limited_eligible_tasks",
    },
    experience: { interactionMode: "hands_free", soundMode: "off" },
    baseline: null,
    tasks: [],
    postRating: null,
    followUp: null,
    startedAt: null,
    protocolCompletedAt: null,
    followUpDueAt: null,
    abandonedAt: null,
  };
  await page.route("**/api/v1/sessions", (route) => route.fulfill({ status: 201, json: session }));
  await page.route("**/api/v1/sessions/*/baseline", (route) =>
    route.fulfill({
      json: {
        ...session,
        status: "in_progress",
        version: 2,
        baseline: 3,
        startedAt: "2026-09-30T04:00:00.000Z",
        experience: { interactionMode: "hands_free", soundMode: "on" },
      },
    }),
  );
  let attempts = 0;
  await page.route("**/api/v1/sessions/*/steps/0", async (route, request) => {
    expect(request.postDataJSON().completionSource).toBe("timer");
    attempts += 1;
    if (attempts === 1) await route.fulfill({ status: 503, json: { code: "temporary_failure" } });
    else
      await route.fulfill({
        json: {
          ...session,
          status: "in_progress",
          version: 3,
          baseline: 3,
          currentStepIndex: 1,
          tasks: [
            {
              stepIndex: 0,
              taskId: "notice_three",
              category: "behavioral",
              correct: 1,
              total: 1,
              durationMs: 60_000,
              completionSource: "timer",
              observedAt: "2026-09-30T04:01:00.000Z",
            },
          ],
        },
      });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  await page.getByRole("button", { name: /Без телефона/ }).click();
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: /Начать протокол/ }).click();
  await expect(page.getByRole("timer", { name: "Осталось 60 секунд" })).toBeVisible();
  await page.clock.runFor(60_000);
  await expect(page.getByRole("button", { name: "Продолжить протокол" })).toBeVisible();
  await page.clock.runFor(60_000);
  expect(attempts).toBe(1);
  await page.getByRole("button", { name: "Продолжить протокол" }).click();
  await expect(page.getByRole("timer", { name: "Осталось 60 секунд" })).toBeVisible();
  await page.clock.runFor(60_000);
  if (attempts === 1) await page.clock.runFor(5_000);
  await expect.poll(() => attempts).toBe(2);
  await expect(page.getByRole("heading", { name: "Как ты чувствуешь себя сейчас?" })).toBeVisible();
});
