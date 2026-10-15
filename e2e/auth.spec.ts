import { USERS } from "./env";
import { expect, test, uiLogin } from "./fixtures";

// Màn 01–02: đăng nhập / đăng ký / đăng xuất – chạy trên mọi trình duyệt và thiết bị.
test.describe("authentication @cross @mobile", () => {
  test("wrong password shows the mapped error and keeps the form", async ({ open }) => {
    const page = await open(null);
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.agent2);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("not-the-password-123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByText("Sai email hoặc mật khẩu")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toHaveValue(USERS.agent2);
  });

  test("protected route → login with next → back to the page; logout ends the session", async ({ open }) => {
    const page = await open(null);
    await page.goto("/app/settings/appearance");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsettings%2Fappearance/);
    await uiLogin(page, USERS.agent2, null);
    await expect(page).toHaveURL(/\/app\/settings\/appearance$/);

    // Cài đặt có nút đăng xuất trên mọi kích thước (menu tài khoản chỉ có ở rail / hộp thư)
    await page.goto("/app/settings");
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });

  test("open redirect via next is refused", async ({ open }) => {
    const page = await open("agent2");
    await page.goto("/login?next=https%3A%2F%2Fevil.example%2F");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("signup validates on the client before calling the API", async ({ open }) => {
    const page = await open(null);
    let calls = 0;
    await page.route("**/api/auth/signup", (route) => ((calls += 1), route.abort()));
    await page.goto("/signup");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("123");
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await expect(page.getByText("Vui lòng nhập họ tên")).toBeVisible();
    await expect(page.getByText("Email không hợp lệ")).toBeVisible();
    await expect(page.getByText("Mật khẩu tối thiểu 6 ký tự")).toBeVisible();
    expect(calls).toBe(0);
  });
});
