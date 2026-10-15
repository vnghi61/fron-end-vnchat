import { expect, stamp, test } from "./fixtures";

// Quản trị (màn 19–24). Chỉ thao tác tự dọn được: không đổi vai trò/khoá tài khoản QA, không đổi cài đặt dùng chung.
test.describe("administration", () => {
  test("admin console: users, policy lock-out guard, webhook and API key shown once, audit", async ({ open }) => {
    test.setTimeout(180_000);
    const a = await open("admin");
    await a.goto("/app");
    await a.getByRole("button", { name: "Mở menu tài khoản" }).first().click();
    await a.getByRole("menuitem", { name: "Quản trị" }).click();
    await expect(a).toHaveURL(/\/admin\/users/);
    await expect(a.getByRole("heading", { name: "Người dùng" })).toBeVisible();

    await test.step("policy matrix refuses to lock the admin out", async () => {
      await a.getByRole("link", { name: "Phân quyền" }).click();
      await a.getByLabel("admin – admin:*", { exact: true }).selectOption("none");
      await expect(a.getByRole("alert").filter({ hasText: "admin phải giữ quyền ghi admin:policies" })).toBeVisible();
      await expect(a.getByRole("button", { name: "Lưu phân quyền" })).toBeDisabled();
      await a.getByRole("button", { name: "Hoàn tác" }).click();
    });

    const id = stamp();
    await test.step("webhook: secret shown once, then deleted", async () => {
      await a.getByRole("link", { name: "Webhook" }).click();
      await a.getByRole("button", { name: "Tạo webhook" }).click();
      const dialog = a.getByRole("dialog");
      await dialog.getByLabel("Tên").fill(`E2E hook ${id}`);
      await dialog.getByLabel("URL nhận (https)").fill("https://example.com/vnchat-hook");
      await dialog.getByRole("checkbox", { name: "Mọi sự kiện (*)" }).click();
      await dialog.getByRole("checkbox", { name: "support.started" }).click();
      await dialog.getByRole("button", { name: "Lưu" }).click();
      const once = a.getByRole("dialog", { name: "Chỉ hiển thị một lần" });
      const secret = (await once.locator("code").innerText()).trim();
      expect(secret.length).toBeGreaterThanOrEqual(16);
      await a.getByRole("button", { name: "Tôi đã lưu" }).click();
      const hook = a.getByRole("listitem").filter({ hasText: `E2E hook ${id}` });
      await hook.getByRole("button", { name: new RegExp(`Thao tác với E2E hook ${id}`) }).click();
      await a.getByRole("menuitem", { name: "Xoá" }).click();
      await a.getByRole("alertdialog").getByRole("button", { name: "Xoá" }).click();
      await expect(a.getByText("Đã xoá webhook")).toBeVisible();
      expect(await a.content()).not.toContain(secret);
    });

    await test.step("API key: ck_ key shown once, then revoked", async () => {
      await a.getByRole("link", { name: "API key" }).click();
      await a.getByRole("button", { name: "Tạo API key" }).first().click();
      await a
        .getByRole("dialog")
        .getByLabel(/Tên \(tên bot/)
        .fill(`E2E bot ${id}`);
      await a.getByRole("dialog").getByRole("checkbox", { name: "messages:read" }).click();
      await a.getByRole("dialog").getByRole("button", { name: "Tạo API key" }).click();
      const key = (await a.getByRole("dialog", { name: "Chỉ hiển thị một lần" }).locator("code").innerText()).trim();
      expect(key.startsWith("ck_")).toBe(true);
      await a.getByRole("button", { name: "Tôi đã lưu" }).click();
      const row = a
        .getByRole("listitem")
        .filter({ hasText: `E2E bot ${id}` })
        .first();
      await row.getByRole("button", { name: "Thu hồi" }).click();
      await a.getByRole("alertdialog").getByRole("button", { name: "Thu hồi" }).click();
      await expect(row.getByText("Đã thu hồi")).toBeVisible();
      expect(await a.content()).not.toContain(key);
    });

    await test.step("audit log lists the actions just taken", async () => {
      await a.getByRole("link", { name: "Nhật ký" }).click();
      await expect(a.getByText("api_key.revoked").first()).toBeVisible();
      await expect(a.getByText("webhook.deleted").first()).toBeVisible();
    });
  });

  test("an agent without admin permission cannot reach /admin @cross", async ({ open }) => {
    const c = await open("agent");
    await c.goto("/app");
    await c.getByRole("button", { name: "Mở menu tài khoản" }).first().click();
    await expect(c.getByRole("menuitem", { name: "Console hỗ trợ" })).toBeVisible();
    await expect(c.getByRole("menuitem", { name: "Quản trị" })).toHaveCount(0);
    await c.keyboard.press("Escape");
    await c.goto("/admin/users");
    await expect(c.getByText("Bạn không có quyền truy cập")).toBeVisible();
    await expect(c.getByRole("heading", { name: "Người dùng" })).toHaveCount(0);
  });
});
