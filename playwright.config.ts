import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const webServerReadyURL =
  process.env.PLAYWRIGHT_WEBSERVER_READY_URL ??
  `http://127.0.0.1:${port}/sign-in`;

export default defineConfig({
  testDir: "./tests/smoke",
  outputDir: ".ai-runs/playwright-test-results",
  reporter: [["list"]],
  // Smoke specs share one PostgreSQL database and create/delete fixtures.
  // Keep the suite serial until per-worker database isolation exists.
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: webServerReadyURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        channel: "chrome",
        viewport: { width: 390, height: 900 },
      },
    },
  ],
});
