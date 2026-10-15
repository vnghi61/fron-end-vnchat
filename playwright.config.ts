import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { API, BASE, HOST, isLocal } from "./e2e/env";

// E2E với backend THẬT (không mock). Chuẩn bị: e2e/README.md.
//   npm run e2e           → Chromium desktop (toàn bộ)
//   npm run e2e:matrix    → + Chrome mobile, Safari/iOS (WebKit), Firefox cho các test gắn @cross / @mobile
// E2E_SERVER=dev (mặc định) | preview (bản build production) | none (đã chạy sẵn / staging qua E2E_BASE_URL)
const server = process.env.E2E_SERVER ?? (isLocal ? "dev" : "none");

const webServer: PlaywrightTestConfig["webServer"] =
  server === "none"
    ? undefined
    : [
        {
          command: server === "preview" ? "npm run preview" : "npm run dev",
          url: `${BASE}/login`,
          reuseExistingServer: true,
          timeout: 180_000,
          // CSP frame-ancestors + bridge cần origin trang host thử nghiệm
          env: { VITE_EMBED_PARENT_ORIGINS: HOST },
        },
        {
          command: "node examples/host/serve.mjs",
          url: HOST,
          reuseExistingServer: true,
          timeout: 30_000,
          env: { VNCHAT_ORIGIN: BASE },
        },
      ];

const auth = { dependencies: ["setup"] };

export default defineConfig({
  testDir: "e2e",
  // backend dùng chung (vai trò, hàng đợi hỗ trợ, rate limit) → chạy tuần tự, có thứ tự
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  metadata: { api: API },
  use: {
    baseURL: BASE,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
  },
  webServer,
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, ...auth },
    { name: "mobile-chrome", use: devices["Pixel 7"], grep: /@mobile/, ...auth },
    { name: "webkit", use: devices["Desktop Safari"], grep: /@cross/, ...auth },
    { name: "mobile-safari", use: devices["iPhone 14"], grep: /@mobile/, ...auth },
    { name: "firefox", use: devices["Desktop Firefox"], grep: /@cross/, ...auth },
  ],
});
