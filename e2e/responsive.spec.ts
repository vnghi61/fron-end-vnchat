import type { Page } from "@playwright/test";
import { directConversation, expect, test } from "./fixtures";

// Điện thoại / WebView hẹp: một pane, màn chat chiếm trọn (bottom nav ẩn), back đóng sheet trước, không cuộn ngang.
const phone = () => (test.info().project.use.isMobile ? {} : { viewport: { width: 390, height: 844 } });
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("phone layout @mobile", () => {
  test("inbox → chat → details sheet; back closes the sheet, then the chat", async ({ open }) => {
    const conv = await directConversation("admin", "agent");
    const page = await open("admin", phone());
    await page.goto("/app");
    await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);

    await page.goto(`/app/c/${conv}`);
    await expect(page.getByLabel("Soạn tin nhắn")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeHidden();
    expect(await noHorizontalScroll(page)).toBe(true);

    await page.getByRole("button", { name: "Mở thông tin cuộc trò chuyện" }).click();
    await expect(page.getByRole("dialog", { name: "Thông tin" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "Thông tin" })).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/app/c/${conv}`));
  });

  test("no horizontal scroll on phone-sized pages", async ({ open }) => {
    for (const [who, path] of [
      ["admin", "/app/search"],
      ["admin", "/app/people"],
      ["admin", "/app/reminders"],
      ["admin", "/app/settings/appearance"],
      ["agent", "/support"],
      ["admin", "/admin/users"],
      ["admin", "/admin/policies"],
    ] as const) {
      const page = await open(who, phone());
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      expect(await noHorizontalScroll(page), path).toBe(true);
      await page.context().close();
    }
  });
});
