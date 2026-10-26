import { existsSync, readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

import { E2E_LOCAL_STORAGE_DIR } from "./tests/smoke/_helpers/storage";

// wrong-route-fixes retro：smoke 會建立、刪除測試資料，不能跑在本機開發資料庫（產品主人看畫面用的那一個）。
// 測試與 `npm run start` 都會讀 .env，所以這裡用同樣的順序找出實際的 DATABASE_URL：環境變數優先，其次 .env。
function effectiveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".env")) return "";
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((entry) => /^\s*DATABASE_URL\s*=/.test(entry));
  return line ? line.replace(/^\s*DATABASE_URL\s*=\s*/, "").replace(/^["']|["']$/g, "") : "";
}

const databaseName = effectiveDatabaseUrl().match(/\/([^/?]+)(\?|$)/)?.[1] ?? "";
if (/_dev$/.test(databaseName)) {
  throw new Error(
    `Playwright 不能在開發資料庫「${databaseName}」上跑（會留下測試帳號與通知）。` +
      "請把 DATABASE_URL 指向測試資料庫，例如 freesoar_tfr_int，並用獨立埠（PORT=3100）。",
  );
}

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
    // 照片功能的端對端測試：用本機資料夾當照片倉庫（正式環境是 Cloudflare R2，見 ADR 0007）。
    env: { STORAGE_DRIVER: "local", LOCAL_STORAGE_DIR: E2E_LOCAL_STORAGE_DIR },
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
