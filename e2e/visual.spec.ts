import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Ảnh chuẩn cho các màn tĩnh (không phụ thuộc dữ liệu). Ảnh phụ thuộc nền tảng: baseline đang lưu cho Chromium/Windows;
// CI Linux cần tạo baseline riêng (`npx playwright test visual --update-snapshots` trên runner). Cập nhật có chủ đích
// khi đổi giao diện, kèm ảnh trong MR.
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "baseline: Chromium desktop");

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
}

for (const scheme of ["light", "dark"] as const) {
  test(`login – ${scheme}`, async ({ open }) => {
    const page = await open(null, { colorScheme: scheme, viewport: { width: 1280, height: 800 } });
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`login-${scheme}.png`, { animations: "disabled", maxDiffPixelRatio: 0.01 });
  });

  test(`widget visitor form – ${scheme}`, async ({ open }) => {
    const page = await open(null, { colorScheme: scheme, viewport: { width: 400, height: 640 } });
    await page.goto("/widget?open=1");
    await expect(page.getByLabel(/Tên của bạn/)).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`widget-form-${scheme}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });
}

test("embed login on a phone", async ({ open }) => {
  const page = await open(null, { viewport: { width: 390, height: 844 } });
  await page.goto("/embed/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("embed-login-phone.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
});
