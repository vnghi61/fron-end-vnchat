// Chụp màn hình nhanh để rà UI (dev): node scripts/shots.mjs <outDir> <route...>
// Cần dev server (npm run dev) + backend. Tài khoản lấy từ biến môi trường SHOT_EMAIL / SHOT_PASSWORD.
import { chromium } from "@playwright/test";

const [outDir, ...routes] = process.argv.slice(2);
const base = process.env.SHOT_BASE || "http://localhost:5174";
const sizes = (process.env.SHOT_SIZES || "375x780,768x900,1280x800").split(",").map((s) => s.split("x").map(Number));
const themes = (process.env.SHOT_THEMES || "light,dark").split(",");

const browser = await chromium.launch();
const context = await browser.newContext({ locale: "vi-VN" });
const page = await context.newPage();
if (process.env.SHOT_EMAIL) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(process.env.SHOT_EMAIL);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(process.env.SHOT_PASSWORD ?? "");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/app/);
}
for (const route of routes) {
  for (const theme of themes) {
    await page.emulateMedia({ colorScheme: theme });
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${base}${route}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(300);
      const name = `${route.replace(/[^a-z0-9]+/gi, "_")}-${theme}-${w}.png`;
      await page.screenshot({ path: `${outDir}/${name}` });
      console.log(name);
    }
  }
}
await browser.close();
