import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { API, BASE, HOST, isLocal } from "./e2e/env";

// E2E với backend THẬT (không mock). Chuẩn bị: e2e/README.md.
//   npm run e2e           → Chromium desktop (toàn bộ)
//   npm run e2e:matrix    → + Chrome mobile, Safari/iOS (WebKit), Firefox cho các test gắn @cross / @mobile
// E2E_SERVER=dev (mặc định) | preview (bản build production) | none (đã chạy sẵn / staging qua E2E_BASE_URL)
const server = process.env.E2E_SERVER ?? (isLocal ? "dev" : "none");
// WebKit (Safari) không gửi cookie `Secure` qua http://localhost – backend docker ở chế độ production đặt Secure cho `jwt`.
// Khi chạy WebKit với server local qua http → dev server dùng transport Bearer (đường của site khác / iframe).
// Chromium/Firefox giữ cookie. Ghi đè bằng E2E_AUTH_TRANSPORT=cookie|bearer.
const authTransport =
  process.env.E2E_AUTH_TRANSPORT ??
  (BASE.startsWith("http://") && process.argv.some((a) => /webkit|safari/i.test(a)) ? "bearer" : undefined);

const webServer: PlaywrightTestConfig["webServer"] =
  server === "none"
    ? undefined
    : [
        {
          command: server === "preview" ? "npm run preview" : "npm run dev",
          url: `${BASE}/login`,
          // preview phải là bản build vừa tạo, transport ép buộc phải đúng → không dùng lại server đang chạy
          reuseExistingServer: server !== "preview" && !authTransport,
          timeout: 180_000,
          // CSP frame-ancestors + bridge cần origin trang host thử nghiệm
          env: { VITE_EMBED_PARENT_ORIGINS: HOST, ...(authTransport ? { VITE_AUTH_TRANSPORT: authTransport } : {}) },
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
