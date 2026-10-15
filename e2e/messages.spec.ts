import type { Page } from "@playwright/test";
import { USERS, type Who } from "./env";
import { apiUser, expect, stamp, test } from "./fixtures";

// Nhóm + thao tác trên tin (màn 05–10): tạo nhóm, trả lời, cảm xúc, sửa, ghim, chuyển tiếp, xoá, bình chọn, nhắc việc,
// tìm kiếm. Mọi thay đổi phải tới thành viên khác qua realtime.

async function createGroup(a: Page, title: string, members: Who[]) {
  await a.getByRole("button", { name: "Cuộc trò chuyện mới" }).first().click();
  await a.getByRole("tab", { name: "Tạo nhóm" }).click();
  await a.getByLabel("Tên nhóm").fill(title);
  for (const who of members) {
    const person = await apiUser(who);
    await a.getByLabel("Tìm theo tên hoặc email").fill(USERS[who].split("@")[0]!);
    await a.getByRole("checkbox", { name: person.name }).click();
  }
  await a
    .getByRole("button", { name: /^Tạo nhóm/ })
    .last()
    .click();
  await expect(a).toHaveURL(/\/app\/c\//);
  await expect(a.getByRole("log").getByText(`đã tạo nhóm “${title}”`)).toBeVisible();
}

const actionsMenu = async (page: Page, text: string) => {
  const bubble = page.getByRole("log").locator("p").getByText(text).first();
  await bubble.hover();
  await page.getByRole("button", { name: "Thao tác với tin nhắn" }).first().click();
};

test.describe("group messaging", () => {
  test("reply, react, edit, pin, forward and delete reach other members", async ({ open }) => {
    const admin = await apiUser("admin");
    const a = await open("admin");
    const b = await open("agent");
    await Promise.all([a.goto("/app"), b.goto("/app")]);
    const title = `Nhóm E2E ${stamp()}`;
    await createGroup(a, title, ["agent", "agent2"]);

    await b
      .getByRole("link", { name: new RegExp(title) })
      .first()
      .click();
    await expect(b.getByRole("log").getByText(`đã tạo nhóm “${title}”`)).toBeVisible();

    const original = `Họp lúc 3h ${stamp()}`;
    await a.getByLabel("Soạn tin nhắn").fill(original);
    await a.getByLabel("Soạn tin nhắn").press("Enter");
    const onB = b.getByRole("log").getByText(original);
    await expect(onB).toBeVisible();

    // trả lời
    await onB.hover();
    await b.getByRole("button", { name: "Trả lời", exact: true }).first().click();
    await expect(b.getByText("Đang trả lời")).toBeVisible();
    const reply = `Ok mình vào ${stamp()}`;
    await b.getByLabel("Soạn tin nhắn").fill(reply);
    await b.getByLabel("Soạn tin nhắn").press("Enter");
    await expect(a.getByRole("log").getByText(reply)).toBeVisible();

    // cảm xúc
    await a.getByRole("log").getByText(reply).hover();
    await a.getByRole("button", { name: "Thả cảm xúc" }).first().click();
    await a.getByRole("button", { name: "Thả 👍" }).click();
    await expect(b.getByRole("button", { name: /Bỏ 👍|Thả 👍/ }).first()).toBeVisible();

    // sửa
    const edited = `${original} (đổi giờ)`;
    await actionsMenu(a, original);
    await a.getByRole("menuitem", { name: "Sửa" }).click();
    await expect(a.getByText("Đang sửa tin nhắn")).toBeVisible();
    await a.getByLabel("Soạn tin nhắn").fill(edited);
    await a.getByLabel("Soạn tin nhắn").press("Enter");
    await expect(b.getByRole("log").locator("p").getByText(edited).first()).toBeVisible();
    await expect(b.getByRole("log").getByText("đã chỉnh sửa").first()).toBeVisible();

    // ghim
    await actionsMenu(a, edited);
    await a.getByRole("menuitem", { name: "Ghim tin" }).click();
    await expect(b.getByRole("log").getByRole("img", { name: "Đã ghim" }).first()).toBeVisible();

    // chuyển tiếp sang chat 1-1 với người tạo nhóm
    await actionsMenu(b, edited);
    await b.getByRole("menuitem", { name: "Chuyển tiếp" }).click();
    await b.getByRole("checkbox", { name: admin.name }).click();
    await b.getByRole("button", { name: /Chuyển tiếp \(1\)/ }).click();
    await expect(b.getByText(/Đã chuyển tiếp tới 1/)).toBeVisible();

    // xoá
    await actionsMenu(a, edited);
    await a.getByRole("menuitem", { name: "Xoá" }).click();
    await a.getByRole("alertdialog").getByRole("button", { name: "Xoá" }).click();
    await expect(b.getByRole("log").getByText("Tin nhắn đã bị xoá").first()).toBeVisible();
  });

  test("poll votes update live; reminders are created and cancelled", async ({ open }) => {
    const a = await open("admin");
    const b = await open("agent");
    await Promise.all([a.goto("/app"), b.goto("/app")]);
    const title = `Bình chọn E2E ${stamp()}`;
    await createGroup(a, title, ["agent"]);
    await b
      .getByRole("link", { name: new RegExp(title) })
      .first()
      .click();

    const question = `Họp lúc mấy giờ ${stamp()}?`;
    await a.getByRole("button", { name: "Thêm nội dung" }).click();
    await a.getByRole("menuitem", { name: "Bình chọn" }).click();
    await a.getByLabel("Câu hỏi").fill(question);
    await a.getByPlaceholder("Phương án 1").fill("9 giờ");
    await a.getByPlaceholder("Phương án 2").fill("14 giờ");
    await a.getByRole("button", { name: "Tạo bình chọn" }).last().click();
    await expect(a.getByRole("log").getByText(question)).toBeVisible();
    await b.getByRole("log").getByRole("radio", { name: "14 giờ" }).click();
    await b.getByRole("log").getByRole("button", { name: "Bình chọn", exact: true }).click();
    await expect(b.getByRole("log").getByRole("button", { name: "Đổi phiếu" })).toBeVisible();
    await expect(a.getByRole("log").getByText("1 người đã bình chọn")).toBeVisible();

    const note = `Nhắc E2E ${stamp()}`;
    await a.getByLabel("Soạn tin nhắn").fill(note);
    await a.getByLabel("Soạn tin nhắn").press("Enter");
    // tin tạm (đang gửi) chưa có menu thao tác – chờ server nhận (người kia đã thấy)
    await expect(b.getByRole("log").getByText(note)).toBeVisible();
    await expect(a.getByRole("log").getByText("Đang gửi")).toHaveCount(0);
    await a.getByRole("log").getByText(note).click({ button: "right" });
    await a.getByRole("menuitem", { name: "Nhắc tôi" }).click();
    await a.getByRole("button", { name: "20 phút nữa" }).click();
    await a.getByRole("button", { name: "Lưu nhắc việc" }).click();
    await expect(a.getByText(/Đã tạo nhắc việc/)).toBeVisible();
    await a.getByRole("link", { name: "Nhắc việc" }).click();
    const item = a.getByRole("listitem").filter({ hasText: note }).first();
    await expect(item).toBeVisible();
    await item.getByRole("button", { name: "Thao tác với tin nhắn" }).click();
    await a.getByRole("menuitem", { name: "Huỷ nhắc việc" }).click();
    await a.getByRole("alertdialog").getByRole("button", { name: "Huỷ nhắc việc" }).click();
    await a.getByRole("tab", { name: "Đã huỷ" }).click();
    await expect(a.getByRole("listitem").filter({ hasText: note }).first()).toBeVisible();
  });

  test("global search finds messages accent-insensitively and people by name", async ({ open }) => {
    const agent2 = await apiUser("agent2");
    const a = await open("admin");
    await a.goto("/app");
    const word = `timkiem${stamp()}`;
    const title = `Tìm kiếm E2E ${stamp()}`;
    await createGroup(a, title, ["agent2"]);
    await a.getByLabel("Soạn tin nhắn").fill(`Nội dung ${word} cần tìm`);
    await a.getByLabel("Soạn tin nhắn").press("Enter");
    await expect(a.getByRole("log").getByText(word)).toBeVisible();

    await a.getByRole("link", { name: "Tìm kiếm" }).first().click();
    await a.getByRole("searchbox", { name: "Tìm kiếm" }).fill(word.toUpperCase());
    await expect(a.getByRole("button", { name: new RegExp(word) }).first()).toBeVisible();
    await a.getByRole("radio", { name: "Người" }).click();
    await a.getByRole("searchbox", { name: "Tìm kiếm" }).fill(USERS.agent2.split("@")[0]!);
    await expect(a.getByRole("button", { name: new RegExp(agent2.name) }).first()).toBeVisible();
  });
});
