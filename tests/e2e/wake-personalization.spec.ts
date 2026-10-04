import { expect, test } from "@playwright/test";

test("пользователь настраивает возможности, контекст и личную рутину", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?demo=1");
  await expect(page.getByText("Сегодня тоже имеет значение")).toHaveCount(0);

  await page.getByRole("button", { name: "Настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await page.getByRole("button", { name: "Удалить профиль" }).click();
  await expect(page.getByText(/В деморежиме профиль не создаётся/)).toBeVisible();
  await page.getByRole("button", { name: "Настройки" }).first().click();
  await expect(page.getByText(/персональном отчёте/i)).toHaveCount(0);
  await page.getByRole("button", { name: /Возможности Движение/ }).click();
  await page.getByRole("button", { name: /Движение Любая нагрузка/ }).click();
  await page.getByRole("button", { name: /Без упражнений/ }).click();
  await page.getByRole("button", { name: /Могу выполнять любые упражнения/ }).click();
  await page.getByRole("button", { name: "Сохранить возможности" }).click();
  await page.getByRole("button", { name: /Упражнения 3 разрешено/ }).click();
  await expect(page.getByRole("button", { name: /Приседания/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "‹ Все возможности" }).click();
  await page.getByRole("button", { name: /Длительность 5 минут/ }).click();
  await page.getByRole("button", { name: /Короткий.*2 минуты/ }).click();
  await page.getByRole("button", { name: "Сохранить возможности" }).click();

  await page.getByRole("button", { name: "Настройки" }).first().click();
  await page.getByRole("button", { name: /Личный распорядок/ }).click();
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
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?demo=1");
  await expect(page.locator(".ps-home-orbit")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Попробовать пробуждение" }).click();
  await page.getByRole("button", { name: "Начать пробуждение" }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Начать протокол" }).click();

  await expect(page.getByTestId("task-illustration").locator("img")).toBeVisible();
  expect(
    await page
      .getByTestId("task-illustration")
      .evaluate((element) => getComputedStyle(element, "::before").animationName),
  ).toBe("ps-first-phase");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .getByTestId("task-illustration")
      .evaluate((element) => getComputedStyle(element, "::before").animationName),
  ).toBe("none");
  await expect(page.getByLabel("Таймер ещё не начат")).toBeVisible();
  await expect(page.locator(".ps-task-action-slot button")).toHaveText("Начать");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const remainingBeforeStart = await page.locator(".ps-task-toolbar").innerText();
  await page.locator(".ps-task-action-slot button").click();
  await page.clock.runFor(1_000);
  expect(await page.locator(".ps-task-toolbar").innerText()).not.toBe(remainingBeforeStart);
  await expect(page.getByLabel("Таймер ещё не начат")).toHaveCount(0);
  await expect(page.locator(".ps-task-action-slot button")).toBeDisabled();

  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "20px";
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .getByTestId("task-illustration")
      .locator("img")
      .evaluate((element) => {
        const image = element as HTMLImageElement;
        return getComputedStyle(image).objectFit;
      }),
  ).toBe("contain");
  await expect(page.locator(".ps-task-action-slot button")).toBeAttached();
  const instruction = await page.locator(".ps-confirm-task > p").boundingBox();
  const action = await page.locator(".ps-task-action-slot").boundingBox();
  expect(instruction).not.toBeNull();
  expect(action).not.toBeNull();
  expect(action!.y).toBeGreaterThanOrEqual(instruction!.y + instruction!.height);
});
