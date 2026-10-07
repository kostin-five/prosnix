import { expect, test } from "@playwright/test";

test("built demo ignores Telegram identity and never contacts API or external services", async ({
  page,
}) => {
  const forbidden: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith("/api/") ||
      (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1")
    )
      forbidden.push(request.url());
  });
  await page.addInitScript(() => {
    Object.assign(window, {
      Telegram: {
        WebApp: {
          initData: "synthetic-identity-must-not-be-used",
          ready() {
            throw new Error("Telegram should be ignored");
          },
          expand() {},
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByText("Пора проснуться")).toBeVisible();
  await page.getByRole("button", { name: "Статистика", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Статистика", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Настройки", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Главная", exact: true }).click();
  await page.getByRole("button", { name: /Попробовать пробуждение/ }).click();
  await expect(page.getByText("Как ты просыпаешься сейчас?")).toBeVisible();
  expect(forbidden).toEqual([]);
});
