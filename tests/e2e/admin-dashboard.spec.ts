import { expect, test } from "@playwright/test";

test("владелец видит агрегированную админ-панель на узком экране", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route("https://telegram.org/js/telegram-web-app.js*", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: "signed-owner-launch-data",
        ready: () => undefined,
        expand: () => undefined,
      },
    };
  });
  await page.route("**/api/v1/auth/telegram", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/admin/growth?days=*", (route) =>
    route.fulfill({
      json: {
        period: {
          days: 7,
          from: "2026-08-29T00:00:00.000Z",
          to: "2026-09-05T00:00:00.000Z",
        },
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
        wakeQuality: {
          pairedSessions: 8,
          averageDelta: 2.25,
          improvedSessions: 7,
          improvedRate: 0.875,
        },
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
          d3: { eligible: 8, retained: 3, rate: 0.375 },
          d7: { eligible: 6, retained: 2, rate: 0.3333 },
          secondSessionWithin7Days: {
            cohort: 9,
            eligible: 7,
            returned: 5,
            pending: 2,
            rate: 0.7143,
          },
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
        billing: { enabled: false, activeSubscriptions: 23, grossStars: 0 },
      },
    }),
  );

  await page.goto("/?demo=1&tgWebAppStartParam=admin");

  await expect(page.getByRole("heading", { name: "Продуктовая аналитика" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Воронка пробуждения" })).toBeVisible();
  await expect(page.getByText("+2.25", { exact: true })).toBeVisible();
  await expect(page.getByText("Ночной сон", { exact: true })).toBeVisible();
  await expect(page.getByText("Вернулись ко второй сессии за 7 дней")).toBeVisible();
  await expect(page.getByText(/ожидают 2/)).toBeVisible();
  await expect(page.getByText("Ошибки доставки", { exact: true })).toBeVisible();
  await expect(page.getByText("23", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("владелец видит безопасный код запроса при ошибке admin API", async ({ page }) => {
  await page.route("https://telegram.org/js/telegram-web-app.js*", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: "signed-owner-launch-data",
        ready: () => undefined,
        expand: () => undefined,
      },
    };
  });
  await page.route("**/api/v1/auth/telegram", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/admin/growth?days=*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "internal_error", requestId: "safe-admin-request-42" }),
    }),
  );

  await page.goto("/?demo=1&tgWebAppStartParam=admin");

  await expect(page.getByRole("heading", { name: "Не удалось загрузить панель" })).toBeVisible();
  await expect(page.getByText("Код запроса: safe-admin-request-42")).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
});

test("обычный пользователь не получает данные панели", async ({ page }) => {
  await page.route("https://telegram.org/js/telegram-web-app.js*", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  await page.route("**/api/v1/admin/growth?days=*", (route) => route.fulfill({ status: 404 }));

  await page.goto("/admin?demo=1");

  await expect(page.getByRole("heading", { name: "Админ-панель закрыта" })).toBeVisible();
  await expect(page.getByText("Доступ не разрешён")).toBeVisible();
  await expect(page.getByText("Воронка пробуждения")).toHaveCount(0);
});
