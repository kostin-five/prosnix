import { expect, test } from "@playwright/test";

test("пользователь настраивает возможности, контекст и личную рутину", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?demo=1");

  await page.getByRole("button", { name: "Настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Что тебе подходит" }) })
    .getByRole("button", { name: "Изменить" })
    .click();
  await page.getByRole("button", { name: /Без упражнений/ }).click();
  await page.getByRole("button", { name: /Могу выполнять любые упражнения/ }).click();
  await expect(page.getByRole("button", { name: /Приседания/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "2 мин" }).click();
  await page.getByRole("button", { name: "Сохранить возможности" }).click();

  await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Рутина после пробуждения" }) })
    .getByRole("button", { name: "Развернуть" })
    .click();
  await page.getByRole("button", { name: "Добавить пункт" }).click();
  await page.getByLabel("Пункт рутины 1").fill("Выпить воды");
  await page.getByText("Показывать рутину").click();
  await page.getByRole("button", { name: "Сохранить рутину" }).click();

  await page.getByRole("button", { name: "Добавить цель" }).click();
  const goalInput = page.getByLabel("Моя причина встать утром");
  await expect(goalInput).toHaveAttribute("enterkeyhint", "done");
  await expect(goalInput).toHaveAttribute("maxlength", "120");
  await goalInput.fill("Закончить важный проект");
  await goalInput.press("Enter");
  await expect(page.getByText("Закончить важный проект")).toBeVisible();

  await page.getByRole("button", { name: "Главная" }).click();
  await page.getByRole("button", { name: "Попробовать пробуждение" }).click();
  await expect(page.getByText("Первые протоколы могут совпадать")).toBeVisible();
  await page.getByRole("button", { name: "После короткого сна" }).click();
  await expect(page.getByRole("button", { name: "2 мин" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  await expect(page.getByRole("heading", { name: "Перед протоколом" })).toBeVisible();
  await expect(page.getByText("Закончить важный проект")).toBeVisible();
  await expect(page.getByText("Насколько бодрым ты себя чувствуешь прямо сейчас?")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
