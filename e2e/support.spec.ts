import { apiUser, expect, stamp, test } from "./fixtures";

// Hỗ trợ khách (màn 15–18): widget khách ↔ console nhân viên. Xem trước khi nhận (chỉ đọc), tranh nhận (409-006),
// chuyển người, trả về hàng đợi, đóng, đánh giá.
test("visitor ↔ agents: watch, claim race, transfer, release, close and rate", async ({ open }) => {
  test.setTimeout(240_000);
  const [agent, agent2] = await Promise.all([apiUser("agent"), apiUser("agent2")]);
  const id = stamp();
  const visitorName = `Khách E2E ${id}`;

  const v = await open(null, { viewport: { width: 1280, height: 800 } });
  await test.step("visitor starts from the widget", async () => {
    await v.goto("/widget");
    await v.getByRole("button", { name: "Mở hỗ trợ trực tuyến" }).click();
    await v.getByLabel(/Tên của bạn/).fill(visitorName);
    await v.getByLabel(/Email để chúng tôi liên hệ lại/).fill(`khach${id}@example.com`);
    await v.getByLabel(/Bạn cần hỗ trợ gì/).fill(`Cho mình hỏi giá gói ${id}`);
    await v.getByRole("button", { name: "Bắt đầu trò chuyện" }).click();
    await expect(v.getByText("Đang chờ nhân viên hỗ trợ…")).toBeVisible();
    await expect(v.getByRole("log").getByText(`Cho mình hỏi giá gói ${id}`)).toBeVisible();
  });

  const d = await open("agent2");
  const c = await open("agent");
  // tab không realtime của Cường để mô phỏng hai người bấm nhận cùng lúc
  const race = await c.context().newPage();
  await race.routeWebSocket(/socket\.io/, (ws) => ws.close());
  await Promise.all([d.goto("/support"), race.goto("/support")]);
  const row = (p: typeof d) => p.getByRole("link", { name: new RegExp(visitorName) }).first();

  await test.step("watching an unclaimed ticket is read-only but live", async () => {
    await row(d).click();
    await expect(d.getByText("Đang xem chỉ đọc – nhận yêu cầu để trả lời")).toBeVisible();
    await v.getByLabel("Soạn tin nhắn").fill("Mình cần gấp nhé");
    await v.getByLabel("Soạn tin nhắn").press("Enter");
    await expect(d.getByRole("log").getByText("Mình cần gấp nhé")).toBeVisible();
  });

  await test.step("claim race → CHAT-409-006 shown and the view reloads", async () => {
    await row(race).click();
    await expect(race.getByRole("button", { name: "Nhận yêu cầu" })).toBeVisible();
    await d.getByRole("button", { name: "Nhận yêu cầu" }).click();
    await expect(d.getByText("Bạn đã nhận yêu cầu")).toBeVisible();
    await race.getByRole("button", { name: "Nhận yêu cầu" }).click();
    await expect(race.getByText("Yêu cầu này đã có nhân viên nhận")).toBeVisible();
    await expect(race.getByText(new RegExp(`${agent2.name} đang xử lý yêu cầu này`))).toBeVisible();
    await race.close();
  });

  await test.step("visitor sees the assignee; agent replies", async () => {
    await expect(v.getByText(`${agent2.name} đang hỗ trợ bạn`)).toBeVisible();
    await d.getByLabel("Soạn tin nhắn").fill("Chào bạn, mình hỗ trợ ngay");
    await d.getByLabel("Soạn tin nhắn").press("Enter");
    await expect(v.getByRole("log").getByText("Chào bạn, mình hỗ trợ ngay")).toBeVisible();
  });

  const ticketUrl = d.url().split("?")[0]!;
  await test.step("transfer to another agent, who releases it back to the queue", async () => {
    await c.goto(ticketUrl);
    await expect(c.getByText(new RegExp(`${agent2.name} đang xử lý yêu cầu này`))).toBeVisible();
    await d.getByRole("button", { name: "Chi tiết yêu cầu" }).click();
    await d.getByRole("menuitem", { name: "Chuyển người" }).click();
    await d
      .getByRole("dialog", { name: "Chuyển yêu cầu cho" })
      .getByRole("button", { name: new RegExp(agent.name) })
      .click();
    await expect(d.getByText(`Đã chuyển cho ${agent.name}`)).toBeVisible();
    await expect(v.getByText(`${agent.name} đang hỗ trợ bạn`)).toBeVisible();

    await c.getByRole("button", { name: "Chi tiết yêu cầu" }).click();
    await c.getByRole("menuitem", { name: "Trả về hàng đợi" }).click();
    await expect(c.getByText("Đã trả về hàng đợi")).toBeVisible();
    await expect(v.getByText("Đang chờ nhân viên hỗ trợ…")).toBeVisible();
  });

  await test.step("agent closes; visitor rates; console shows the rating", async () => {
    await d.getByRole("button", { name: "Nhận yêu cầu" }).click();
    await expect(d.getByText("Bạn đã nhận yêu cầu")).toBeVisible();
    await d.getByRole("button", { name: "Chi tiết yêu cầu" }).click();
    await d.getByRole("menuitem", { name: "Đóng yêu cầu" }).click();
    await d.getByRole("alertdialog").getByRole("button", { name: "Đóng yêu cầu" }).click();
    await expect(d.getByText("Đã đóng yêu cầu")).toBeVisible();

    await expect(v.getByText("Cuộc trò chuyện đã kết thúc", { exact: true }).first()).toBeVisible();
    await v.getByRole("radio", { name: "5 sao" }).click();
    await v.getByLabel("Góp ý thêm").fill("Rất nhanh");
    await v.getByRole("button", { name: "Gửi đánh giá" }).click();
    await expect(v.getByText("Bạn đã đánh giá 5/5")).toBeVisible();
    await expect(d.getByRole("complementary", { name: "Chi tiết yêu cầu" }).getByText("5/5")).toBeVisible();
  });
});
