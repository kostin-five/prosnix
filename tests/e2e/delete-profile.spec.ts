import { expect, test } from "@playwright/test";

test("пользователь подтверждает удаление и начинает с чистого профиля", async ({ page }) => {
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
        user: { id: "clean-user", locale: "ru", timezone: "Europe/Moscow" },
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
    }),
  );
  await page.route("**/api/v1/analytics/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        methodVersion: "analytics-v1",
        computedAt: "2026-08-28T06:00:00.000Z",
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
      }),
    }),
  );
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 204 }));

  await page.goto("/");
  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByRole("button", { name: "Добавить цель" }).click();
  await page.getByLabel("Моя причина встать утром").fill("Личная цель для удаления");
  await page.getByRole("button", { name: "Сохранить", exact: true }).last().click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(window.localStorage).some((key) =>
          key.startsWith("prosnix.morning-preferences.v1:"),
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Удалить мой профиль" }).click();
  const deletion = page.waitForRequest(
    (request) => request.url().includes("/api/v1/me") && request.method() === "DELETE",
  );
  await page.getByRole("button", { name: "Да, удалить всё" }).click();
  await deletion;
  await expect(page.getByRole("heading", { name: "Prosnix" })).toBeVisible();
  await expect(page.getByText(/0 из 7 экспериментов/)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(window.localStorage).some((key) =>
          key.startsWith("prosnix.morning-preferences.v1:"),
        ),
      ),
    )
    .toBe(false);
});
