import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 15_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm --filter @awc/web dev --host 127.0.0.1 --port 4173",
    env: {
      VITE_WAKE_TASK_CATALOG_V9_ENABLED: "true",
      VITE_WAKE_TASK_SUBSTITUTION_ENABLED: "true",
    },
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
