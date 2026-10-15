import { mkdirSync } from "node:fs";
import { test as setup, expect } from "@playwright/test";
import { API, authFile, password, USERS, type Who } from "./env";
import { uiLogin } from "./fixtures";

// Kiểm tra môi trường rồi đăng nhập 3 tài khoản QA một lần, lưu phiên (e2e/.auth/*.json – gitignore) cho mọi project.
setup("environment is ready", async () => {
  password(); // ném lỗi rõ ràng nếu thiếu
  for (const [who, email] of Object.entries(USERS)) expect(email, `E2E_USER for ${who}`).toBeTruthy();
  const health = await fetch(`${API}/health`).catch(() => null);
  expect(health?.ok, `backend ${API}/health – chạy docker compose ở back-end-vnchat`).toBe(true);
  mkdirSync("e2e/.auth", { recursive: true });
});

for (const who of Object.keys(USERS) as Who[]) {
  setup(`sign in ${who}`, async ({ page }) => {
    await uiLogin(page, USERS[who]);
    await expect(page).toHaveURL(/\/app/);
    await page.context().storageState({ path: authFile(who) });
  });
}
