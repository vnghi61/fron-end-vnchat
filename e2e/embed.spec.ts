import type { Frame, Page } from "@playwright/test";
import { API, BASE, HOST, password, USERS } from "./env";
import { apiUser, expect, stamp, test, uiLogin } from "./fixtures";

// Nhúng cross-site (màn 25–26, docs/embed-webview-architecture.md §8): trang host HOST (127.0.0.1:5180, examples/host)
// khác SITE với app BASE (localhost:5174) – cookie SameSite không đi, storage bị partition như ở site đối tác thật.

const EVIL = "http://evil.test";
const evilFramer = `<!doctype html><title>evil</title><iframe src="${BASE}/embed" style="width:600px;height:400px"></iframe>`;
const evilPoster = `<!doctype html><title>evil-poster</title><script>
  setTimeout(() => {
    const target = window.parent.frames[0];
    target.postMessage({ source: "vnchat-host", v: 1, type: "theme:set", theme: "dark" }, "*");
    target.postMessage({ source: "vnchat-host", v: 1, type: "navigate", route: "/embed/people" }, "*");
    document.title = "sent";
  }, 300);
</script>`;

async function withEvilOrigin(page: Page) {
  await page.context().route(`${EVIL}/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: new URL(route.request().url()).pathname === "/poster" ? evilPoster : evilFramer,
    }),
  );
}

const hostLog = (page: Page) => page.locator("#log");
const chatFrame = (page: Page, path: string) => {
  const frame = page.frames().find((f) => f.url().startsWith(`${BASE}${path}`));
  if (!frame)
    throw new Error(
      `no frame ${path} (frames: ${page
        .frames()
        .map((f) => f.url())
        .join(", ")})`,
    );
  return frame;
};
const storageOf = (frame: Frame, key: string) => frame.evaluate((k) => localStorage.getItem(k), key);
/** Chỉ trả tên cookie – báo cáo lỗi không bao giờ chứa giá trị token. */
const jwtCookies = async (page: Page) =>
  (await page.context().cookies([API, BASE])).filter((c) => c.name === "jwt").map((c) => `${c.name}@${c.domain}`);
/** Khung bị CSP chặn không chạy script của VNChat → #root trống / không truy cập được. */
async function rendered(page: Page, prefix: string) {
  const frame = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(prefix));
  if (!frame) return false;
  return frame.evaluate(() => !!document.getElementById("root")?.childElementCount).catch(() => false);
}

test("CSP frame-ancestors is set per route", async () => {
  test.skip(test.info().project.name !== "chromium", "HTTP headers – once");
  const csp = async (path: string) => (await fetch(`${BASE}${path}`)).headers.get("content-security-policy");
  expect(await csp("/embed")).toBe(`frame-ancestors 'self' ${HOST}`);
  expect(await csp("/embed/login")).toBe(`frame-ancestors 'self' ${HOST}`);
  expect(await csp("/widget")).toBe(`frame-ancestors 'self' ${HOST}`);
  for (const path of ["/app", "/login", "/support", "/admin"]) expect(await csp(path)).toBe("frame-ancestors 'self'");
});

test.describe("widget loader on a third-party site @cross", () => {
  test("launcher → iframe on first open, isolated visitor session, unread badge, host API", async ({ open }) => {
    test.setTimeout(180_000);
    const agent2 = await apiUser("agent2");
    const h = await open(null, { viewport: { width: 1280, height: 800 } });
    await h.goto(HOST);
    const launcher = h.getByRole("button", { name: "Mở hỗ trợ trực tuyến" });
    await expect(launcher).toBeVisible();
    await expect(h.locator("iframe")).toHaveCount(0);

    await launcher.click();
    const frameEl = h.locator('iframe[title="VNChat"]');
    await expect(frameEl).toBeVisible();
    await expect(hostLog(h)).toContainText(/^open$/m);
    await expect(hostLog(h)).toContainText(/^ready$/m);
    const w = h.frameLocator('iframe[title="VNChat"]');
    await expect(w.getByLabel(/Tên của bạn/)).toBeVisible();
    const frame = chatFrame(h, "/widget");
    expect(new URL(frame.url()).searchParams.get("siteId")).toBe("demo-shop");
    expect((await hostLog(h).innerText()).match(/^ready$/gm)).toHaveLength(1);

    await h.getByRole("button", { name: 'setTheme("dark")' }).click();
    await frame.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");

    const id = stamp();
    await w.getByLabel(/Tên của bạn/).fill(`Khách nhúng ${id}`);
    await w.getByLabel(/Bạn cần hỗ trợ gì/).fill(`Hỏi từ trang host ${id}`);
    await w.getByRole("button", { name: "Bắt đầu trò chuyện" }).click();
    await expect(w.getByText("Đang chờ nhân viên hỗ trợ…")).toBeVisible();
    expect(await storageOf(frame, "vnchat.widget.token")).toBeTruthy();
    expect(await jwtCookies(h)).toEqual([]);
    await expect(hostLog(h)).toContainText(/^unread 0$/m);

    // thu nhỏ trong khung → host ẩn iframe, focus về launcher
    await w.getByRole("button", { name: "Thu nhỏ" }).click();
    await expect(hostLog(h)).toContainText(/^close$/m);
    await expect(frameEl).toBeHidden();
    await expect(launcher).toBeFocused();

    // nhân viên trả lời khi đang thu nhỏ → badge; mở lại → thấy tên + tin, chưa đọc về 0
    const d = await open("agent2");
    await d.goto("/support");
    await d
      .getByRole("link", { name: new RegExp(`Khách nhúng ${id}`) })
      .first()
      .click();
    await d.getByRole("button", { name: "Nhận yêu cầu" }).click();
    await expect(d.getByText("Bạn đã nhận yêu cầu")).toBeVisible();
    await d.getByLabel("Soạn tin nhắn").fill(`Chào bạn ${id}`);
    await d.getByLabel("Soạn tin nhắn").press("Enter");
    // tin hệ thống "… đã tham gia hỗ trợ" cũng được backend tính là chưa đọc → ≥ 1
    await expect(hostLog(h)).toContainText(/^unread [1-9]\d*$/m);
    await expect(launcher).toHaveText(/^[1-9]\d*$/);

    await h.getByRole("button", { name: "VNChat.open()" }).click();
    await expect(frameEl).toBeVisible();
    await expect(w.getByRole("log").getByText(`Chào bạn ${id}`)).toBeVisible();
    await expect(w.getByText(`${agent2.name} đang hỗ trợ bạn`)).toBeVisible();
    await expect(hostLog(h)).toContainText(/unread [1-9]\d*\n(?:.*\n)*unread 0$/m);

    // dọn: đóng yêu cầu
    await d.getByRole("button", { name: "Chi tiết yêu cầu" }).click();
    await d.getByRole("menuitem", { name: "Đóng yêu cầu" }).click();
    await d.getByRole("alertdialog").getByRole("button", { name: "Đóng yêu cầu" }).click();
    await expect(d.getByText("Đã đóng yêu cầu")).toBeVisible();
  });

  test("messages from a non-allow-listed origin are ignored", async ({ open }) => {
    test.skip(test.info().project.name !== "chromium", "postMessage origin check – once");
    const h = await open(null, { viewport: { width: 1280, height: 800 } });
    await withEvilOrigin(h);
    await h.goto(HOST);
    await h.getByRole("button", { name: "Mở hỗ trợ trực tuyến" }).click();
    await expect(h.frameLocator('iframe[title="VNChat"]').getByLabel(/Tên của bạn/)).toBeVisible();
    const frame = chatFrame(h, "/widget");
    await frame.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await h.evaluate((src) => {
      const f = document.createElement("iframe");
      f.src = src;
      f.style.cssText = "width:1px;height:1px;border:0";
      document.body.appendChild(f);
    }, `${EVIL}/poster`);
    await expect
      .poll(
        async () =>
          (await h
            .frames()
            .find((f) => f.url().startsWith(EVIL))
            ?.title()
            .catch(() => "")) ?? "",
      )
      .toBe("sent");
    await h.waitForTimeout(500);
    expect(await frame.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("light");
    expect(frame.url().startsWith(`${BASE}/widget`)).toBe(true);
  });
});

test("widget is fullscreen on a phone @mobile", async ({ open }) => {
  const h = await open(null, test.info().project.use.isMobile ? {} : { viewport: { width: 390, height: 844 } });
  await h.goto(HOST);
  await h.getByRole("button", { name: "Mở hỗ trợ trực tuyến" }).click();
  const frameEl = h.locator('iframe[title="VNChat"]');
  await expect(h.frameLocator('iframe[title="VNChat"]').getByLabel(/Tên của bạn/)).toBeVisible();
  const viewport = h.viewportSize()!;
  const box = (await frameEl.boundingBox())!;
  expect(Math.round(box.width)).toBe(viewport.width);
  expect(Math.round(box.height)).toBe(viewport.height);
  const noHorizontalScroll = await chatFrame(h, "/widget").evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noHorizontalScroll).toBe(true);
});

test.describe("full app in an iframe (/embed) @cross", () => {
  test("sign in inside the frame, host commands, frame containment", async ({ open }) => {
    const e = await open(null, { viewport: { width: 1440, height: 900 } });
    await e.goto(`${HOST}/embed.html`);
    const f = e.frameLocator("#vnchat");
    await expect(f.getByLabel("Email")).toBeVisible();
    expect(new URL(chatFrame(e, "/embed").url()).pathname).toBe("/embed/login");
    await expect(hostLog(e)).toContainText('"type":"ready"');

    // ?next= ra ngoài /embed bị bỏ qua sau khi đăng nhập
    await e.evaluate(
      (src) => ((document.getElementById("vnchat") as HTMLIFrameElement).src = src),
      `${BASE}/embed/login?next=%2Fadmin%2Fusers`,
    );
    await expect.poll(() => chatFrame(e, "/embed").url()).toContain("next=%2Fadmin");
    await f.getByLabel("Email").fill(USERS.admin);
    await f.getByLabel("Mật khẩu", { exact: true }).fill(password());
    await f.getByRole("button", { name: "Đăng nhập" }).click();
    await expect.poll(() => new URL(chatFrame(e, "/embed").url()).pathname, { timeout: 30_000 }).toBe("/embed");
    await expect(e.locator("#unread")).toHaveText(/^\d+$/);
    const frame = chatFrame(e, "/embed");
    expect(await storageOf(frame, "vnchat.embed.token")).toBeTruthy();
    expect(await storageOf(frame, "vnchat.auth.token")).toBeNull();
    expect(await jwtCookies(e)).toEqual([]);

    // lệnh từ host
    await e.getByRole("button", { name: "Mở Tìm kiếm" }).click();
    await expect.poll(() => new URL(chatFrame(e, "/embed").url()).pathname).toBe("/embed/search");
    await e.getByRole("button", { name: "Theme tối" }).click();
    await frame.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
    await e.getByRole("button", { name: "English" }).click();
    await frame.waitForFunction(() => document.documentElement.lang === "en");

    // đăng nhập trong khung không làm đăng nhập app standalone cùng trình duyệt
    const s = await e.context().newPage();
    await s.goto(`${BASE}/app`);
    await expect(s).toHaveURL(/\/login/);
    await s.close();

    // điều hướng phía client ra khỏi /embed ngay trong khung → FrameGuard
    await frame.evaluate(() => {
      history.pushState(null, "", "/admin/users");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(f.getByText(/khung nhúng|embedded frame/).first()).toBeVisible();
    await expect(f.getByRole("heading", { name: /^(Người dùng|Users)$/ })).toHaveCount(0);
  });

  test("framing is blocked for a non-allow-listed site and for non-embed routes", async ({ open }) => {
    const x = await open(null);
    await withEvilOrigin(x);
    await x.goto(`${EVIL}/framer`);
    await x.waitForTimeout(1500);
    expect(await rendered(x, `${BASE}/embed`)).toBe(false);

    await x.goto(`${HOST}/embed.html`);
    await x.evaluate((src) => {
      const f = document.createElement("iframe");
      f.src = src;
      document.body.appendChild(f);
    }, `${BASE}/app`);
    await x.waitForTimeout(1500);
    expect(await rendered(x, `${BASE}/app`)).toBe(false);
  });
});

test("native WebView bridge (React Native) @mobile", async ({ open, browserName }) => {
  const n = await open(null);
  await n.addInitScript(() => {
    const w = window as unknown as { __native: unknown[]; ReactNativeWebView: { postMessage: (m: string) => void } };
    w.__native = [];
    w.ReactNativeWebView = { postMessage: (m) => w.__native.push(JSON.parse(m)) };
  });
  await n.goto("/embed");
  await expect(n).toHaveURL(/\/embed\/login/);
  await n.waitForFunction(() =>
    (window as unknown as { __native: { type: string; source: string }[] }).__native.some(
      (m) => m.type === "ready" && m.source === "vnchat-embed",
    ),
  );
  const receive = (msg: object) =>
    n.evaluate(
      (m) => (window as unknown as { vnchatHost: { receive: (x: object) => void } }).vnchatHost.receive(m),
      msg,
    );
  await receive({ source: "vnchat-host", v: 1, type: "theme:set", theme: "dark" });
  await n.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  await receive({ source: "vnchat-host", v: 1, type: "navigate", route: "/admin/users" });
  await receive({ source: "vnchat-host", v: 1, type: "viewport:set", height: 500 });
  await n.waitForTimeout(300);
  expect(new URL(n.url()).pathname).toBe("/embed/login");
  expect(await n.evaluate(() => document.documentElement.style.getPropertyValue("--app-height"))).toBe("500px");
  // đăng nhập trong WebView bằng Bearer, không cookie
  await uiLogin(n, USERS.agent2, null);
  await expect(n).toHaveURL(/\/embed$/);
  if (browserName === "webkit") {
    // WebKit vẫn lưu Set-Cookie dù fetch dùng credentials "omit" (contract map B17) – frontend không chặn được; trong
    // iframe khác site Safari chặn cookie bên thứ ba nên các test nhúng ở trên vẫn kiểm "không cookie".
    test
      .info()
      .annotations.push({ type: "known-issue", description: "B17: WebKit stores Set-Cookie with credentials omit" });
  } else {
    expect(await jwtCookies(n)).toEqual([]);
  }
});
