import { expect, test } from "@playwright/test";

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
      }),
    }),
  );

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Продолжить пробуждение?" })).toBeVisible();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByText("Шаг 2 из 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Память" })).toBeVisible();
});

test("пользователь может серверно закрыть прерванную сессию и начать заново", async ({ page }) => {
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
      }),
    }),
  );
  await page.route("**/api/v1/sessions/session-1/abandon", async (route, request) => {
    expect(request.headers()["if-match"]).toBe("3");
    expect(request.headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "session-1", status: "abandoned", version: 4 }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Начать заново" }).click();
  await expect(page.getByRole("heading", { name: "Adaptive Wake Coach" })).toBeVisible();
});
