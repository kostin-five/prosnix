import { expect, test, type Page, type Route } from "@playwright/test";

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

test("расписание сохраняется на сервере и показывает следующее напоминание", async ({ page }) => {
  const enabledRequests: boolean[] = [];
  await installTelegram(page);
  await page.route("**/api/v1/auth/telegram", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/bootstrap", (route) =>
    json(route, {
      user: { id: "00000000-0000-4000-8000-000000000042", locale: "ru", timezone: "UTC" },
      activeSession: null,
      dueFollowUpSessionId: null,
    }),
  );
  await page.route("**/api/v1/me/wake-schedule", async (route, request) => {
    if (request.method() === "GET") return json(route, { schedule: null });
    const payload = request.postDataJSON() as {
      localTime: string;
      timezone: string;
      enabled: boolean;
    };
    expect(payload.localTime).toBe("07:15");
    enabledRequests.push(payload.enabled);
    return json(route, {
      ...payload,
      nextTriggerAt: payload.enabled ? "2026-08-30T07:15:00.000Z" : null,
      botStatus: "unknown",
      revision: 1,
    });
  });

  await page.goto("/");
  await expect(page.getByText("Telegram-напоминание")).toBeVisible();
  await page.getByRole("button", { name: "Изменить" }).click();
  await page.getByLabel("Время пробуждения").fill("07:15");
  await page.getByLabel("Включить Telegram-напоминание").check();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText(/Следующее:/)).toBeVisible();
  await expect(page.getByText(/не системный будильник/i)).toBeVisible();
  await page.getByRole("button", { name: "Изменить" }).click();
  await page.getByLabel("Включить Telegram-напоминание").uncheck();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Напоминание выключено")).toBeVisible();
  expect(enabledRequests).toEqual([true, false]);
});
