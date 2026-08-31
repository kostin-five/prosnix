import { expect, test, type Page, type Route } from "@playwright/test";

const baseSession = {
  id: "00000000-0000-4000-8000-000000000100",
  userId: "00000000-0000-4000-8000-000000000042",
  assignment: {
    id: "00000000-0000-4000-8000-000000000101",
    protocolKey: "e2e-water",
    protocolVersion: 1,
    strategyVersion: "e2e-v1",
    phase: "learning",
    hypothesis: "Проверяем полный путь сохранения",
    steps: [{ index: 0, taskId: "water", category: "behavioral" }],
  },
  status: "assigned",
  currentStepIndex: 0,
  version: 1,
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
    }),
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
    taskId: "water",
    category: "behavioral",
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

  await page.goto("/");
  await page.getByRole("button", { name: /Симулировать пробуждение/ }).click();
  await page.getByRole("button", { name: /Начать протокол/ }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Начать протокол →" }).click();
  await expect(page.getByRole("heading", { name: "Стакан воды" })).toBeVisible();
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page.getByRole("button", { name: "Выпил ✓" }).click();
  await page.getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить результат" }).click();
  await expect(page.getByRole("heading", { name: "Протокол завершён" })).toBeVisible();
  await page.getByRole("button", { name: "Ответить сейчас" }).click();
  await page.getByRole("button", { name: /Да, уже встал/ }).click();
  await expect(page.getByText("Встал и не лёг обратно")).toBeVisible();
  await expect(page.getByText("Ответ сохранён и учтён в профиле пробуждения")).toBeVisible();
});
