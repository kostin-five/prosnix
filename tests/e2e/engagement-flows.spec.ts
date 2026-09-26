import { expect, test, type Page, type Route } from "@playwright/test";

const user = { id: "user-engagement", locale: "ru", timezone: "Europe/Moscow" };
const personalization = {
  profileRevision: 1,
  movementLevel: "full",
  availableResources: ["water", "bright_light", "floor_space"],
  excludedTaskIds: [],
  fallbackReason: "none",
};
const wakeProfile = {
  movementLevel: "full",
  availableResources: ["water", "bright_light", "floor_space"],
  excludedTaskIds: [],
  defaultDurationMinutes: 5,
  onboardingCompleted: true,
  revision: 1,
};

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
  await page.route("**/api/v1/auth/telegram", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/legal/status", (route) =>
    json(route, {
      privacyVersion: "2026-08-31",
      termsVersion: "2026-08-31",
      accepted: true,
      acceptedAt: "2026-08-31T00:00:00.000Z",
    }),
  );
}

function bootstrap(activeSession: unknown) {
  return {
    user,
    activeSession,
    dueFollowUpSessionId: null,
    wakeSchedule: null,
    wakeProfile,
    wakeRoutine: { enabled: false, items: [], revision: 0 },
  };
}

test("первая анкета идёт по страницам без горизонтального скролла и сохраняется один раз", async ({
  page,
}) => {
  await installTelegram(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.route("**/api/v1/bootstrap", (route) =>
    json(route, {
      ...bootstrap(null),
      wakeProfile: {
        ...wakeProfile,
        movementLevel: "none",
        onboardingCompleted: false,
        revision: 0,
      },
    }),
  );
  let saves = 0;
  await page.route("**/api/v1/me/wake-profile", async (route, request) => {
    saves += 1;
    expect(request.headers()["idempotency-key"]).toBeTruthy();
    expect(request.headers()["if-match"]).toBe("0");
    const input = request.postDataJSON();
    expect(input.onboardingCompleted).toBe(true);
    expect(input.excludedTaskIds).toContain("steps");
    await json(route, { ...input, revision: 1 });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Подберём безопасные задания" })).toBeVisible();
  expect(
    await page
      .locator('[class*="onboarding-step-in"]')
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  for (const label of ["Только лёгкое движение", "Пройтись", "Есть вода", "5 мин"]) {
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.getByRole("button", { name: label }).click();
    if (label !== "5 мин") await page.getByRole("button", { name: "Далее" }).click();
  }
  expect(saves).toBe(0);
  await page.getByRole("button", { name: "Сохранить возможности" }).click();
  await expect(page.getByRole("button", { name: "Начать пробуждение" })).toBeVisible();
  expect(saves).toBe(1);
  await expect(page.locator('[data-testid="pix-avatar"]')).toHaveCount(0);
});

test("mobile user заменяет текущий шаг с причиной и видит серверную альтернативу", async ({
  page,
}) => {
  await installTelegram(page);
  const steps = [
    { index: 0, taskId: "math", category: "cognitive" },
    { index: 1, taskId: "water", category: "behavioral" },
  ];
  const effectiveSteps = [{ index: 0, taskId: "reaction", category: "cognitive" }, steps[1]];
  const activeSession = {
    session: {
      id: "session-substitution",
      status: "in_progress",
      currentStepIndex: 0,
      version: 3,
      wakeContext: "night_sleep",
      durationMinutes: 5,
      personalization,
      sessionKind: "primary",
    },
    protocol: { key: "substitution-e2e", version: 9, title: "Замена", steps },
    assignment: { strategyVersion: "adaptive-v6", phase: "learning", hypothesis: "Замена" },
    baseline: 3,
    postRating: null,
    substitutions: [],
  };
  await page.route("**/api/v1/bootstrap", (route) => json(route, bootstrap(activeSession)));
  await page.route(
    "**/api/v1/sessions/session-substitution/steps/0/substitution",
    async (route, request) => {
      expect(request.headers()["if-match"]).toBe("3");
      expect(request.headers()["idempotency-key"]).toBeTruthy();
      expect(request.postDataJSON()).toEqual({ reason: "unwilling_now" });
      await json(route, {
        id: "session-substitution",
        userId: user.id,
        assignment: {
          id: "assignment-substitution",
          protocolKey: "substitution-e2e",
          protocolVersion: 9,
          strategyVersion: "adaptive-v6",
          phase: "learning",
          hypothesis: "Замена",
          steps,
        },
        effectiveSteps,
        substitutions: [
          {
            id: "replacement-1",
            stepIndex: 0,
            originalTaskId: "math",
            replacementTaskId: "reaction",
            reason: "unwilling_now",
            operationId: request.headers()["idempotency-key"],
            createdAt: "2026-09-24T06:00:00.000Z",
          },
        ],
        status: "in_progress",
        currentStepIndex: 0,
        version: 4,
        wakeContext: "night_sleep",
        durationMinutes: 5,
        personalization,
        sessionKind: "primary",
        baseline: 3,
        tasks: [],
        postRating: null,
        followUp: null,
        startedAt: "2026-09-24T06:00:00.000Z",
        protocolCompletedAt: null,
        followUpDueAt: null,
        abandonedAt: null,
      });
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByRole("heading", { name: "Математика" })).toBeVisible();
  await page.getByRole("button", { name: "Заменить", exact: true }).first().click();
  await page.getByRole("button", { name: /Не хочу сейчас/ }).click();
  await expect(page.getByRole("heading", { name: "Реакция" })).toBeVisible();
});

test("mobile user безопасно продолжает сохранённый recovery-раунд", async ({ page }) => {
  await installTelegram(page);
  const steps = [{ index: 0, taskId: "reaction", category: "cognitive" }];
  await page.route("**/api/v1/bootstrap", (route) =>
    json(
      route,
      bootstrap({
        session: {
          id: "session-recovery",
          status: "in_progress",
          currentStepIndex: 0,
          version: 2,
          wakeContext: "night_sleep",
          durationMinutes: 2,
          personalization,
          sessionKind: "recovery",
          parentSessionId: "session-primary",
          recoveryBaseline: { sessionId: "session-primary", ratingKind: "post_protocol" },
        },
        protocol: { key: "recovery-reaction", version: 9, title: "Recovery", steps },
        assignment: {
          strategyVersion: "recovery-v1",
          phase: "verification",
          hypothesis: "Короткий дополнительный раунд",
        },
        baseline: 4,
        postRating: null,
        substitutions: [],
      }),
    ),
  );

  await page.goto("/");
  await expect(page.getByText("Дополнительный раунд сохранён")).toBeVisible();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByRole("heading", { name: "Реакция" })).toBeVisible();
  await expect(page.getByText("Шаг 1 из 1")).toBeVisible();
});
