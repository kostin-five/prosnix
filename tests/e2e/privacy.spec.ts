import { expect, test } from "@playwright/test";

test("политика конфиденциальности доступна без Telegram-авторизации", async ({ page }) => {
  let authRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/auth/telegram")) authRequests += 1;
  });
  await page.route("https://telegram.org/js/telegram-web-app.js*", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );

  await page.goto("/privacy");

  await expect(page.getByRole("heading", { name: "Политика конфиденциальности" })).toBeVisible();
  await expect(page.getByText("Какие данные мы обрабатываем")).toBeVisible();
  await expect(page.getByRole("link", { name: "Открыть @wake_coach_bot" })).toBeVisible();
  expect(authRequests).toBe(0);
});
