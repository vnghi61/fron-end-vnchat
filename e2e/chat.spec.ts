import { USERS } from "./env";
import { apiUser, directConversation, expect, groupConversation, sendViaApi, stamp, test } from "./fixtures";

// Chat 1-1 trên API Conversations – đây là bài kiểm "tương đương" để gỡ màn legacy /api/messages/* + newMessage
// (spec Phase 7, contract map §7): danh bạ → mở chat, gửi/nhận realtime, chưa đọc, đang nhập, đã xem, trực tuyến,
// gửi lại idempotent, khôi phục khi mất kết nối, phân trang lịch sử.
test.describe("direct chat (legacy parity) @cross", () => {
  test("open a direct chat from the new-chat dialog and talk in realtime", async ({ open }) => {
    const [admin, agent] = await Promise.all([apiUser("admin"), apiUser("agent")]);
    const a = await open("admin");
    const b = await open("agent");
    await Promise.all([a.goto("/app"), b.goto("/app")]);

    await a.getByRole("button", { name: "Cuộc trò chuyện mới" }).first().click();
    await a.getByLabel("Tìm theo tên hoặc email").fill(USERS.agent.split("@")[0]!);
    await a
      .getByRole("button", { name: new RegExp(agent.name) })
      .first()
      .click();
    await expect(a).toHaveURL(/\/app\/c\/[a-f0-9]+/);
    await expect(a.getByText("Đang hoạt động").first()).toBeVisible(); // B đang online

    const hello = `Xin chào ${stamp()}`;
    await a.getByLabel("Soạn tin nhắn").fill(hello);
    await a.getByLabel("Soạn tin nhắn").press("Enter");
    await expect(a.getByRole("log").getByText(hello)).toBeVisible();

    // B: hội thoại nổi lên đầu inbox với số chưa đọc, mở ra thì thấy tin
    const row = b.getByRole("link", { name: new RegExp(admin.name) }).first();
    await expect(row).toContainText(hello);
    await expect(row.getByText(/^\d+$/)).toBeVisible();
    await row.click();
    await expect(b.getByRole("log").getByText(hello)).toBeVisible();

    // B đang nhập → A thấy; B trả lời → A nhận; A thấy "Đã xem"
    await b.getByLabel("Soạn tin nhắn").pressSequentially("Chào bạn", { delay: 50 });
    await expect(a.getByText(/đang nhập/)).toBeVisible();
    const reply = `Chào bạn ${stamp()}`;
    await b.getByLabel("Soạn tin nhắn").fill(reply);
    await b.getByLabel("Soạn tin nhắn").press("Enter");
    await expect(a.getByRole("log").getByText(reply)).toBeVisible();
    await expect(a.getByRole("log").getByText("Đã xem").first()).toBeVisible();
  });

  test("a failed send is retried with the same clientMsgId and shows exactly one bubble", async ({ open }) => {
    const conv = await directConversation("admin", "agent");
    const a = await open("admin");
    const b = await open("agent");
    await Promise.all([a.goto(`/app/c/${conv}`), b.goto(`/app/c/${conv}`)]);
    await expect(a.getByLabel("Soạn tin nhắn")).toBeEditable();

    const bodies: { clientMsgId: string; text: string }[] = [];
    let mode: "drop-request" | "drop-response" = "drop-request";
    await a.route(/\/api\/conversations\/[a-f0-9]+\/messages$/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON() as { clientMsgId: string; text: string };
      bodies.push(body);
      if (bodies.filter((x) => x.clientMsgId === body.clientMsgId).length > 1) return route.continue();
      if (mode === "drop-response") await route.fetch(); // server đã tạo tin, client không nhận được phản hồi
      return route.abort("failed");
    });

    // 1) request không tới server → bong bóng lỗi → "Gửi lại" dùng lại clientMsgId
    const first = `Thử gửi lại ${stamp()}`;
    await a.getByLabel("Soạn tin nhắn").fill(first);
    await a.getByLabel("Soạn tin nhắn").press("Enter");
    await expect(a.getByRole("alert").filter({ hasText: /Gửi lại/ })).toBeVisible();
    await a.getByRole("button", { name: "Gửi lại" }).click();
    await expect(b.getByRole("log").getByText(first)).toHaveCount(1);
    await expect(a.getByRole("log").getByText(first)).toHaveCount(1);
    const tries = bodies.filter((x) => x.text === first);
    expect(tries).toHaveLength(2);
    expect(tries[1]!.clientMsgId).toBe(tries[0]!.clientMsgId);

    // 2) server đã nhận nhưng phản hồi mất → message.new cùng clientMsgId gộp bong bóng, không có bản trùng
    mode = "drop-response";
    const second = `Mất phản hồi ${stamp()}`;
    await a.getByLabel("Soạn tin nhắn").fill(second);
    await a.getByLabel("Soạn tin nhắn").press("Enter");
    await expect(b.getByRole("log").getByText(second)).toHaveCount(1);
    const retry = a.getByRole("button", { name: "Gửi lại" });
    if (await retry.isVisible()) await retry.click();
    await expect(a.getByRole("button", { name: "Gửi lại" })).toHaveCount(0);
    await expect(a.getByRole("log").getByText(second)).toHaveCount(1);
    await a.waitForTimeout(1000);
    await expect(b.getByRole("log").getByText(second)).toHaveCount(1);
  });

  test("messages sent while the socket is down are recovered by /api/sync, once", async ({ open }) => {
    test.skip(test.info().project.name !== "chromium", "routeWebSocket-based outage runs on Chromium");
    const conv = await directConversation("admin", "agent");
    const a = await open("admin");
    let blocked = false;
    const live = new Set<{ close: () => Promise<void> }>();
    await a.routeWebSocket(/socket\.io/, (ws) => {
      if (blocked) return void ws.close();
      ws.connectToServer();
      live.add(ws);
    });
    await a.route("**/socket.io/**", (route) => (blocked ? route.abort() : route.continue()));
    await a.goto(`/app/c/${conv}`);
    await expect(a.getByLabel("Soạn tin nhắn")).toBeEditable();
    await a.waitForTimeout(1000);

    blocked = true;
    for (const ws of live) await ws.close();
    live.clear();
    await expect(a.getByText("Mất kết nối – đang kết nối lại…")).toBeVisible();

    const text = `Tin lúc mất kết nối ${stamp()}`;
    await sendViaApi("agent", conv, text);
    await a.waitForTimeout(800);
    await expect(a.getByRole("log").getByText(text)).toHaveCount(0);

    blocked = false;
    await expect(a.getByRole("log").getByText(text)).toHaveCount(1, { timeout: 30_000 });
    await expect(a.getByText("Mất kết nối – đang kết nối lại…")).toBeHidden();
  });

  test("older history pages in on scroll-up and keeps seq order", async ({ open }) => {
    test.skip(test.info().project.name !== "chromium", "seeding 55 messages once is enough");
    test.setTimeout(240_000);
    const tag = stamp();
    const conv = await groupConversation("agent2", ["admin"], `Lịch sử E2E ${tag}`);
    for (let i = 1; i <= 55; i += 1) await sendViaApi("agent2", conv, `Lịch sử ${tag} #${String(i).padStart(2, "0")}`);

    const a = await open("admin");
    await a.goto(`/app/c/${conv}`);
    const log = a.getByRole("log");
    await expect(log.getByText(`Lịch sử ${tag} #55`)).toBeVisible();
    await expect(log.getByText(`Lịch sử ${tag} #01`)).toHaveCount(0); // ngoài trang đầu (50 tin)

    for (let i = 0; i < 30 && !(await log.getByText(`Lịch sử ${tag} #01`).count()); i += 1) {
      await log.evaluate((el) => (el.scrollTop = 0));
      await a.waitForTimeout(400);
    }
    await expect(log.getByText(`Lịch sử ${tag} #01`)).toBeVisible();
    const text = await log.innerText();
    const positions = ["01", "02", "03", "04", "05"].map((n) => text.indexOf(`Lịch sử ${tag} #${n}`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((x, y) => x - y)).toEqual(positions);
  });
});
