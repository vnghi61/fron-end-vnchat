import { test as base, expect, type BrowserContext, type BrowserContextOptions, type Page } from "@playwright/test";
import { API, authFile, password, USERS, type Who } from "./env";

export { expect };

// Lỗi console được phép: phản hồi lỗi có chủ đích (401/403/409/429 hiện bằng UI), CSP chặn khung, socket bị cắt trong
// test mất kết nối. Mọi lỗi khác (và mọi pageerror) làm test fail.
const ALLOWED_CONSOLE = [
  /status of (401|403|404|409|429)/,
  /Refused to (frame|display)/,
  /frame-ancestors/,
  /WebSocket (connection|is closed)/,
  /net::ERR_(FAILED|ABORTED|CONNECTION_REFUSED|INTERNET_DISCONNECTED)/,
  // Firefox báo websocket bị cắt khi trang chuyển đi (đăng xuất, goto) – không phải lỗi app
  /can.t establish a connection to the server at ws:/,
  /was interrupted while the page was loading/,
  // Firefox: tải font bị huỷ (NS_BINDING_ABORTED) khi khung/trang chuyển đi giữa chừng
  /downloadable font: download failed .*status=2152398850/,
  /Failed to load resource/,
];

/** `/api/messages/search` là API mới – không nằm trong danh sách. */
const LEGACY_API = [
  /^\/api\/messages\/users$/,
  /^\/api\/messages\/send\//,
  /^\/api\/messages\/[a-f0-9]{24}$/,
  /^\/api\/auth\/check$/,
  /^\/api\/auth\/update-profile$/,
];

type Open = (who: Who | null, options?: BrowserContextOptions) => Promise<Page>;

export const test = base.extend<{ open: Open; problems: string[] }>({
  problems: async ({}, use) => {
    const list: string[] = [];
    await use(list);
    expect.soft(list, "console/page errors").toEqual([]);
  },
  /** Trang mới trong context riêng: `open("admin")` dùng phiên đã lưu ở auth.setup; `open(null)` là khách chưa đăng nhập. */
  open: async ({ browser, problems }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    const project = testInfo.project.use;
    const device: BrowserContextOptions = {
      viewport: project.viewport,
      userAgent: project.userAgent,
      deviceScaleFactor: project.deviceScaleFactor,
      isMobile: project.isMobile,
      hasTouch: project.hasTouch,
      locale: project.locale,
      timezoneId: project.timezoneId,
      baseURL: project.baseURL,
    };
    await use(async (who, options = {}) => {
      const context = await browser.newContext({
        ...device,
        ...(who ? { storageState: authFile(who) } : {}),
        ...options,
      });
      contexts.push(context);
      const page = await context.newPage();
      const label = who ?? "guest";
      page.on("console", (m) => {
        if (m.type() === "error" && !ALLOWED_CONSOLE.some((re) => re.test(m.text())))
          problems.push(`[${label}] ${m.text()}`);
      });
      page.on("pageerror", (e) => {
        // WebKit báo vòng ResizeObserver (thông báo được dời sang frame sau) là lỗi – không phải lỗi app
        if (!/ResizeObserver loop/.test(e.message)) problems.push(`[${label} pageerror] ${e.message}`);
      });
      // API legacy đã gỡ ở Phase 7 (contract map §7) – app không được gọi lại
      page.on("request", (r) => {
        const path = new URL(r.url()).pathname;
        if (LEGACY_API.some((re) => re.test(path))) problems.push(`[${label}] legacy API call ${r.method()} ${path}`);
      });
      return page;
    });
    for (const context of contexts) await context.close();
  },
});

/** Hậu tố ngắn để dữ liệu mỗi lần chạy không trùng nhau. */
export const stamp = () => `${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 100)}`;

/**
 * Đăng nhập qua giao diện; tôn trọng 429 (backend giới hạn đăng nhập theo IP/phút).
 * `path = null`: điền form ngay trên trang hiện tại (vd. sau khi bị chuyển hướng tới /login?next=…).
 */
export async function uiLogin(page: Page, email: string, path: string | null = "/login") {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (path !== null || attempt > 0) await page.goto(path ?? page.url());
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password());
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    const outcome = await Promise.race([
      page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 }).then(() => "ok" as const),
      page
        .getByText(/Thử lại sau \d+ giây|quá nhiều/i)
        .first()
        .waitFor({ timeout: 30_000 })
        .then(() => "limited" as const),
    ]);
    if (outcome === "ok") return;
    await page.waitForTimeout(15_000);
  }
  throw new Error(`login rate-limited for ${email}`);
}

// ---------- API trực tiếp (chỉ để chuẩn bị dữ liệu; thao tác cần kiểm thử luôn đi qua giao diện) ----------

interface ApiUser {
  _id: string;
  name: string;
  token: string;
}
const sessions = new Map<Who, ApiUser>();

async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? "10");
      await new Promise((r) => setTimeout(r, Math.min(Math.max(wait, 1), 60) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
  throw new Error(`${method} ${path} still rate-limited`);
}

/** Phiên API (Bearer) của tài khoản QA – dùng chung trong một lần chạy để không tốn lượt đăng nhập. */
export async function apiUser(who: Who): Promise<ApiUser> {
  const cached = sessions.get(who);
  if (cached) return cached;
  const user = await call<ApiUser>("POST", "/api/auth/login", { email: USERS[who], password: password() });
  sessions.set(who, user);
  return user;
}

export async function directConversation(from: Who, to: Who): Promise<string> {
  const [a, b] = await Promise.all([apiUser(from), apiUser(to)]);
  const conv = await call<{ _id: string }>("POST", "/api/conversations/direct", { userId: b._id }, a.token);
  return conv._id;
}

/** Nhóm mới (mỗi lượt chạy một nhóm riêng – lịch sử không lẫn với lượt trước). */
export async function groupConversation(owner: Who, members: Who[], title: string): Promise<string> {
  const [user, ...others] = await Promise.all([apiUser(owner), ...members.map(apiUser)]);
  const conv = await call<{ _id: string }>(
    "POST",
    "/api/conversations/group",
    { title, memberIds: others.map((o) => o._id) },
    user!.token,
  );
  return conv._id;
}

export async function sendViaApi(who: Who, conversationId: string, text: string) {
  const user = await apiUser(who);
  return call<{ _id: string; seq: number }>(
    "POST",
    `/api/conversations/${conversationId}/messages`,
    { text, clientMsgId: crypto.randomUUID() },
    user.token,
  );
}
