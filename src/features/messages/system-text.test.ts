import { describe, expect, it } from "vitest";
import { previewText } from "@/features/conversations/display";
import { conversation, member, message, ME, OTHER, PEER, user } from "@/test/factories";
import { systemText } from "./system-text";

const group = conversation({
  kind: "group",
  title: "Dự án",
  peer: undefined,
  members: [member(ME, "Bình"), member(PEER, "Cường"), member(OTHER, "Dung")],
});

describe("systemText", () => {
  it.each([
    [{ kind: "group.created", title: "Dự án" }, "Cường đã tạo nhóm “Dự án”"],
    [{ kind: "member.added", memberIds: [ME, OTHER] }, "Cường đã thêm Bình và Dung"],
    [{ kind: "member.role_changed", memberId: OTHER, role: "admin" }, "Cường đã đặt Dung làm Phó nhóm"],
    [
      { kind: "group.history_visibility", historyVisibility: "since_join" },
      "Cường đã đặt thành viên mới chỉ xem tin sau khi vào",
    ],
    [{ kind: "support.closed" }, "Cuộc trò chuyện đã kết thúc"],
    [{ kind: "something.new" }, "Hoạt động trong cuộc trò chuyện"],
  ])("%j", (metadata, expected) => {
    const m = message({ type: "system", text: String(metadata.kind), metadata, sender: user(PEER, "Cường") });
    expect(systemText(m, group, {})).toBe(expected);
  });

  it("biệt danh riêng ưu tiên hơn tên thật", () => {
    expect(
      systemText(message({ type: "system", metadata: { kind: "member.left", memberId: OTHER } }), group, {
        [OTHER]: "Dung kế toán",
      }),
    ).toBe("Dung kế toán đã rời nhóm");
  });
});

describe("previewText", () => {
  const last = (over = {}) => ({
    id: "m1",
    seq: 1,
    senderId: PEER,
    type: "text" as const,
    preview: "Xin chào",
    deleted: false,
    at: "2026-10-14T00:00:00Z",
    ...over,
  });

  it("tin của tôi có tiền tố 'Bạn:'", () => {
    expect(previewText(last({ senderId: ME }), conversation(), ME, {})).toBe("Bạn: Xin chào");
  });
  it("nhóm có tên người gửi", () => {
    expect(previewText(last(), group, ME, {})).toBe("Cường: Xin chào");
  });
  it("ảnh/tệp bản địa hoá từ preview server", () => {
    expect(previewText(last({ type: "file", preview: "[Tệp] baocao.pdf" }), conversation(), ME, {})).toBe(
      "[Tệp] baocao.pdf",
    );
  });
  it("tin đã xoá", () => {
    expect(previewText(last({ deleted: true }), conversation(), ME, {})).toBe("Tin nhắn đã bị xoá");
  });
  void user;
});
