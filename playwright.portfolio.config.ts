import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/portfolio",
  use: { baseURL: "http://127.0.0.1:4174", ...devices["iPhone 13"], browserName: "chromium" },
  webServer: {
    command:
      "pnpm --filter @awc/web exec vite preview --outDir dist-demo --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
});
