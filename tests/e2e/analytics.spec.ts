import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function openTelegramApp(page: Page) {
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: "signed-test-launch-data",
        ready: () => undefined,
        expand: () => undefined,
      },
    };
  });
  await page.route("**/api/v1/auth/telegram", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route("**/api/v1/bootstrap", (route) =>
    json(route, {
      user: { id: "user-1", locale: "ru", timezone: "Europe/Moscow" },
      activeSession: null,
      dueFollowUpSessionId: null,
    }),
  );
}

test("профиль показывает только воспроизводимые метрики смешанных протоколов", async ({ page }) => {
  await openTelegramApp(page);
  await page.route("**/api/v1/analytics/profile", (route) =>
    json(route, {
      methodVersion: "analytics-v1",
      averageDelta: {
        key: "average-delta",
        value: 3.5,
        evidenceCount: 6,
        evidenceIds: ["s1", "s2", "s3", "s4", "s5", "s6"],
        confidence: "medium",
      },
      riseSuccess: {
        key: "rise-success",
        value: 0.6,
        evidenceCount: 5,
        evidenceIds: ["s1", "s2", "s3", "s4", "s5"],
        confidence: "low",
      },
      protocolEffects: [
        {
          key: "protocol:movement-with@1",
          value: 5,
          evidenceCount: 3,
          evidenceIds: ["s1", "s2", "s3"],
          confidence: "low",
        },
        {
          key: "protocol:movement-without@1",
          value: 2,
          evidenceCount: 3,
          evidenceIds: ["s4", "s5", "s6"],
          confidence: "low",
        },
      ],
      factorEffects: [
        {
          key: "factor:movement:movement-a",
          value: 3,
          evidenceCount: 3,
          evidenceIds: ["s1", "s2", "s3", "s4", "s5", "s6"],
          confidence: "low",
        },
      ],
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Статистика" }).click();

  await expect(page.getByText("+3.5", { exact: true })).toBeVisible();
  await expect(page.getByText("60%", { exact: true })).toBeVisible();
  await expect(page.getByText("Движение", { exact: true })).toBeVisible();
  await expect(page.getByText("Низкая уверенность · 3 парных сравнения")).toBeVisible();
  await expect(page.getByText("movement-with · версия 1")).toBeVisible();
  await expect(page.getByText("AI Wake Coach")).toHaveCount(0);
});
