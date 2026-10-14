import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { GuestOnly, RequireAuth, RequirePermission } from "@/app/guards";
import { useSession } from "@/core/auth/session";
import { TooltipProvider } from "@/core/ui/components";
import { apiError, authResponse, bootstrap } from "@/test/fixtures";
import { server } from "@/test/server";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: <GuestOnly />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/signup", element: <SignupPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: "/app", element: <p>Trang app</p> },
          {
            path: "/admin",
            element: (
              <RequirePermission permission="admin">
                <p>Trang admin</p>
              </RequirePermission>
            ),
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  return router;
}

beforeEach(() => {
  useSession.setState({ status: "anonymous", bootstrap: null, notice: null });
});

describe("Đăng nhập", () => {
  it("báo lỗi tiếng Việt theo code CHAT-400-015 và không lộ message backend", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(apiError("CHAT-400-015", "invalid credentials"), { status: 400 }),
      ),
    );
    renderAt("/login");
    await userEvent.type(screen.getByLabelText("Email"), "an@example.com");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "sai-mat-khau");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sai email hoặc mật khẩu");
    expect(screen.queryByText(/invalid credentials/)).not.toBeInTheDocument();
  });

  it("validate phía client trước khi gọi API", async () => {
    renderAt("/login");
    await userEvent.type(screen.getByLabelText("Email"), "khong-phai-email");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByText("Email không hợp lệ")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("login 200 → tải bootstrap → chuyển về ?next", async () => {
    server.use(
      http.post("/api/auth/login", () => HttpResponse.json(authResponse())),
      http.get("/api/me/bootstrap", () => HttpResponse.json(bootstrap())),
    );
    const router = renderAt(`/login?next=${encodeURIComponent("/app")}`);
    await userEvent.type(screen.getByLabelText("Email"), "an@example.com");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "secret1");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByText("Trang app")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/app");
    expect(useSession.getState().bootstrap?.me.name).toBe("Nguyễn Văn An");
  });

  it("nút hiện mật khẩu có aria-pressed", async () => {
    renderAt("/login");
    const toggle = screen.getByRole("button", { name: "Hiện mật khẩu" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Ẩn mật khẩu" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("type", "text");
  });
});

describe("Đăng ký", () => {
  it("email đã dùng (400 + CHAT-409-000) gắn lỗi vào ô email", async () => {
    server.use(
      http.post("/api/auth/signup", () =>
        HttpResponse.json(apiError("CHAT-409-000", "email already used"), { status: 400 }),
      ),
    );
    renderAt("/signup");
    await userEvent.type(screen.getByLabelText("Họ và tên"), "An");
    await userEvent.type(screen.getByLabelText("Email"), "an@example.com");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "secret1");
    await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await screen.findByText("Thao tác bị xung đột, vui lòng thử lại")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("mật khẩu < 6 ký tự bị chặn", async () => {
    renderAt("/signup");
    await userEvent.type(screen.getByLabelText("Họ và tên"), "An");
    await userEvent.type(screen.getByLabelText("Email"), "an@example.com");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await screen.findAllByText("Mật khẩu tối thiểu 6 ký tự")).not.toHaveLength(0);
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Guard", () => {
  it("chưa đăng nhập vào /app → /login?next=/app", async () => {
    const router = renderAt("/app");
    expect(await screen.findByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent("/app")}`);
  });

  it("quyền admin lấy từ bootstrap.permissions, không từ roles", async () => {
    useSession.setState({
      status: "authenticated",
      bootstrap: bootstrap({ me: { ...bootstrap().me, roles: ["admin"] } }),
    });
    renderAt("/admin");
    expect(await screen.findByText("Bạn không có quyền truy cập")).toBeInTheDocument();
  });

  it("có permissions.admin → vào được", async () => {
    useSession.setState({
      status: "authenticated",
      bootstrap: bootstrap({ permissions: { admin: true, agent: false } }),
    });
    renderAt("/admin");
    expect(await screen.findByText("Trang admin")).toBeInTheDocument();
  });
});
