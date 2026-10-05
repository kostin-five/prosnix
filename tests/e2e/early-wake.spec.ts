import { expect, test } from "@playwright/test";

test("Проснулся ведёт к оценке, сохраняя только выполненные задания", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.clock.install();
  await page.goto("/?demo=1");
  await page.getByRole("button", { name: "Попробовать пробуждение" }).click();
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: /Начать протокол/ }).click();
  await page.getByRole("button", { name: "Протокол", exact: true }).click();
  await expect(page.getByRole("button", { name: "Закрыть протокол" })).toBeVisible();
  const awakened = page.getByRole("button", { name: "Проснулся", exact: true });
  const close = page.getByRole("button", { name: "Закрыть протокол" });
  expect((await awakened.boundingBox())!.x).toBeLessThan((await close.boundingBox())!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await awakened.click();
  await expect(page.getByRole("heading", { name: "Как ты чувствуешь себя сейчас?" })).toBeVisible();
  await page.getByRole("button", { name: "8", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить результат" }).click();
  await expect(page.getByRole("heading", { name: "Пробуждение завершено досрочно" })).toBeVisible();
  await expect(page.getByText(/Сохранены только выполненные задания/)).toBeVisible();
});
