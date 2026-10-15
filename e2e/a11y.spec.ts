import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { USERS, type Who } from "./env";
import { directConversation, expect, test, uiLogin } from "./fixtures";

// Khả năng tiếp cận: axe-core (WCAG 2.1 A/AA) trên các màn chính, sáng + tối; bàn phím; giảm chuyển động.
// Vi phạm mức serious/critical làm test fail; mọi vi phạm (kể cả minor) được đính kèm báo cáo HTML.

async function scan(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(300); // animation vào của dialog/sheet
  // @axe-core/playwright khai Page của playwright-core bản cũ hơn (thiếu API mới) – cùng đối tượng lúc chạy
  const axePage = page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"];
  const results = await new AxeBuilder({ page: axePage })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  await test.info().attach(`axe-${label}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });
  const blocking = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes[0]?.target.join(" ")} – ${v.help}`);
  expect(blocking, `axe ${label}`).toEqual([]);
}

// lần đầu mở một trang lazy, dev server mới biên dịch chunk → cho thời gian chờ rộng hơn mặc định
const ready = expect.configure({ timeout: 30_000 });

const screens: {
  name: string;
  who: Who | null;
  path: string | (() => Promise<string>);
  ready: (p: Page) => Promise<void>;
}[] = [
  { name: "login", who: null, path: "/login", ready: (p) => ready(p.getByLabel("Email")).toBeVisible() },
  { name: "signup", who: null, path: "/signup", ready: (p) => ready(p.getByLabel("Họ và tên")).toBeVisible() },
  {
    name: "inbox",
    who: "admin",
    path: "/app",
    ready: (p) => ready(p.getByRole("region", { name: "Trò chuyện" })).toBeVisible(),
  },
  {
    name: "conversation",
    who: "admin",
    path: async () => `/app/c/${await directConversation("admin", "agent")}`,
    ready: (p) => ready(p.getByLabel("Soạn tin nhắn")).toBeVisible(),
  },
  { name: "search", who: "admin", path: "/app/search", ready: (p) => ready(p.getByRole("searchbox")).toBeVisible() },
  {
    name: "settings",
    who: "admin",
    path: "/app/settings/appearance",
    ready: (p) => ready(p.getByRole("main")).toBeVisible(),
  },
  {
    name: "widget",
    who: null,
    path: "/widget?open=1",
    ready: (p) => ready(p.getByLabel(/Tên của bạn/)).toBeVisible(),
  },
  {
    name: "support-console",
    who: "agent",
    path: "/support",
    ready: (p) => ready(p.getByRole("group", { name: "Hàng đợi hỗ trợ" })).toBeVisible(),
  },
  {
    name: "admin-users",
    who: "admin",
    path: "/admin/users",
    ready: (p) => ready(p.getByRole("heading", { name: "Người dùng" })).toBeVisible(),
  },
  {
    name: "admin-policies",
    who: "admin",
    path: "/admin/policies",
    ready: (p) => ready(p.getByRole("button", { name: "Lưu phân quyền" })).toBeVisible(),
  },
  { name: "embed-login", who: null, path: "/embed/login", ready: (p) => ready(p.getByLabel("Email")).toBeVisible() },
];

test.describe("accessibility (axe)", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const screen of screens) {
      test(`${screen.name} – ${scheme}`, async ({ open }) => {
        const page = await open(screen.who, { colorScheme: scheme });
        await page.goto(typeof screen.path === "string" ? screen.path : await screen.path());
        await screen.ready(page);
        await scan(page, `${screen.name}-${scheme}`);
      });
    }
  }

  test("new-chat dialog @mobile", async ({ open }) => {
    const page = await open("admin");
    await page.goto("/app");
    await page.getByRole("button", { name: "Cuộc trò chuyện mới" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await scan(page, "new-chat-dialog");
  });
});

test.describe("keyboard and motion @cross", () => {
  test("sign in with the keyboard only; focus is visible", async ({ open }) => {
    const page = await open(null);
    await page.goto("/login");
    await page.getByLabel("Email").focus();
    await page.keyboard.type(USERS.agent2);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Mật khẩu", { exact: true })).toBeFocused();
    const outline = await page
      .getByLabel("Mật khẩu", { exact: true })
      .evaluate((el) => getComputedStyle(el).outlineStyle + getComputedStyle(el).boxShadow);
    expect(outline).not.toBe("nonenone");
    await uiLogin(page, USERS.agent2, null);
    await expect(page).toHaveURL(/\/app/);
  });

  test("dialogs trap focus and Escape returns it to the trigger", async ({ open }) => {
    const page = await open("admin");
    await page.goto("/app");
    const trigger = page.getByRole("button", { name: "Cuộc trò chuyện mới" }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("reduced motion disables animations and transitions", async ({ open }) => {
    const page = await open("admin", { reducedMotion: "reduce" });
    await page.goto("/app");
    await page.getByRole("button", { name: "Cuộc trò chuyện mới" }).first().click();
    const durations = await page
      .getByRole("dialog")
      .evaluate((el) => [getComputedStyle(el).animationDuration, getComputedStyle(el).transitionDuration]);
    const seconds = (v: string) =>
      v.split(",").map((x) => (x.trim().endsWith("ms") ? parseFloat(x) / 1000 : parseFloat(x)));
    for (const d of durations) expect(Math.max(...seconds(d))).toBeLessThan(0.001);
  });
});
