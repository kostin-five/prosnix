import { expect, test } from "@playwright/test";

test("wake-ссылка сразу открывает исходную оценку без промежуточного экрана", async ({ page }) => {
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
        activeSession: null,
        dueFollowUpSessionId: null,
        wakeSchedule: {
          localTime: "07:00",
          timezone: "Europe/Moscow",
          enabled: true,
          nextTriggerAt: "2026-08-31T04:00:00.000Z",
          botStatus: "available",
          revision: 1,
        },
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
    }),
  );
  await page.route("**/api/v1/sessions", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "session-1",
        userId: "user-1",
        status: "assigned",
        currentStepIndex: 0,
        version: 1,
        assignment: {
          id: "assignment-1",
          protocolKey: "learning",
          protocolVersion: 1,
          strategyVersion: "learning-v1",
          phase: "learning",
          hypothesis: "Тест",
          steps: [{ index: 0, taskId: "math", category: "cognitive" }],
        },
        baseline: null,
        tasks: [],
        postRating: null,
        followUp: null,
        startedAt: null,
        protocolCompletedAt: null,
        followUpDueAt: null,
        abandonedAt: null,
      }),
    }),
  );
  await page.goto("/?source=wake");
  await expect(page.getByRole("heading", { name: "Перед протоколом" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отложить на 5 минут" })).toHaveCount(0);
});
