import { expect, test } from "@playwright/test";

test("единый логотип и доступные карточки на узком экране и с крупным шрифтом", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const fontSize of [16, 24]) {
      await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important; }` });
      for (const tab of ["Главная", "Статистика", "Настройки"]) {
        await page.getByRole("button", { name: tab, exact: true }).click();
        const logo = page.getByRole("img", { name: "Prosnix", exact: true });
        await expect(logo).toBeVisible();
        expect(
          await logo
            .locator("img")
            .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        ).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const cardsFit = await page
          .locator(".ps-home > .ps-surface, .ps-settings > .ps-surface, .ps-stats > section")
          .evaluateAll((cards) =>
            cards.every((card) => card.scrollHeight <= card.clientHeight + 2),
          );
        expect(cardsFit).toBe(true);
        const buttons = page.locator(".ps-bottom-nav button");
        for (const button of await buttons.all()) {
          const box = await button.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.width).toBeGreaterThanOrEqual(44);
        }
        if (width === 390 && fontSize === 16) {
          await page.screenshot({ path: test.info().outputPath(`${tab}.png`) });
        }
      }
    }
  }
});
