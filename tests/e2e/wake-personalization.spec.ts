import { expect, test } from "@playwright/test";

test("пользователь настраивает возможности, контекст и личную рутину", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?demo=1");

  await page.getByRole("button", { name: "Настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await expect(page.getByText(/персональном отчёте/i)).toHaveCount(0);
  await page.getByRole("button", { name: /Возможности Движение/ }).click();
  await page.getByRole("button", { name: "Изменить" }).click();
  await page.getByRole("button", { name: /Без упражнений/ }).click();
  await page.getByRole("button", { name: /Могу выполнять любые упражнения/ }).click();
  await expect(page.getByRole("button", { name: /Приседания/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /Короткий.*2 минуты/ }).click();
  await page.getByRole("button", { name: "Сохранить возможности" }).click();

  await page.getByRole("button", { name: "Настройки" }).first().click();
  await page.getByRole("button", { name: /Личный распорядок/ }).click();
  await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Рутина после пробуждения" }) })
    .getByRole("button", { name: "Развернуть" })
    .click();
  await page.getByRole("button", { name: "Добавить пункт" }).click();
  await page.getByLabel("Пункт рутины 1").fill("Выпить воды");
  await page.getByText("Показывать рутину").click();
  await page.getByRole("button", { name: "Сохранить рутину" }).click();

  await page.getByRole("button", { name: "Настройки" }).first().click();
  await page.getByRole("button", { name: /Цель в жизни/ }).click();
  await page.getByRole("button", { name: "Добавить цель" }).click();
  const goalInput = page.getByLabel("Моя жизненная цель");
  await expect(goalInput).toHaveAttribute("enterkeyhint", "done");
  await expect(goalInput).toHaveAttribute("maxlength", "120");
  await goalInput.fill("Закончить важный проект");
  await goalInput.press("Enter");
  await expect(page.getByText("Закончить важный проект")).toBeVisible();

  await page.getByRole("button", { name: "Главная" }).click();
  await page.getByRole("button", { name: "Попробовать пробуждение" }).click();
  await expect(page.getByText("Первые протоколы могут совпадать")).toBeVisible();
  await page.getByRole("button", { name: "После короткого сна" }).click();
  await expect(page.getByRole("button", { name: /Короткий.*2 мин/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  await expect(page.getByRole("heading", { name: "Насколько ты бодр сейчас?" })).toBeVisible();
  await expect(page.getByText("Закончить важный проект")).toBeVisible();
  await expect(
    page.getByText("Оцени своё состояние до протокола. Здесь нет правильного ответа."),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("цель открывается с главной, а юридические документы доступны из настроек", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?demo=1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: /Твоя цель/ }).click();
  await expect(page.getByRole("heading", { name: "Цель в жизни", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Настройки" }).first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: /Конфиденциальность/ }).click();
  await expect(page.getByRole("link", { name: "Политика конфиденциальности" })).toHaveAttribute(
    "href",
    "/privacy",
  );
  await expect(page.getByRole("link", { name: "Пользовательское соглашение" })).toHaveAttribute(
    "href",
    "/terms",
  );
  await page.getByRole("link", { name: "Политика конфиденциальности" }).click();
  await expect(page.getByRole("heading", { name: "Политика конфиденциальности" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("протокол показывает крупную инструкцию и действие без выхода за мобильный экран", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?demo=1");
  await expect(page.locator(".ps-home-orbit")).toHaveCSS("animation-name", "ps-orbit-drift");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".ps-home-orbit")).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Попробовать пробуждение" }).click();
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Начать протокол" }).click();

  await expect(page.getByTestId("task-illustration").locator("img")).toBeVisible();
  await expect(page.getByLabel("Таймер ещё не начат")).toBeVisible();
  await expect(page.locator(".ps-task-action-slot button")).toHaveText("Начать");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.locator(".ps-task-action-slot button").click();
  await expect(page.getByLabel("Таймер ещё не начат")).toHaveCount(0);
  await expect(page.locator(".ps-task-action-slot button")).toBeDisabled();
});
