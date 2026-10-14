import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { qk } from "@/core/api/query";
import { message, ME } from "@/test/factories";
import { asDeleted, flattenMessages, upsertMessage, withMyReactions, type MessagePages } from "./cache";

let qc: QueryClient;
const seed = (pages: { seqs: number[]; hasMore: boolean }[]) =>
  qc.setQueryData<MessagePages>(qk.messages("c1"), {
    pages: pages.map((p) => ({
      items: p.seqs.map((seq) => message({ seq })),
      nextCursor: p.hasMore ? "x" : null,
      hasMore: p.hasMore,
    })),
    pageParams: pages.map((_, i) => (i === 0 ? undefined : `p${i}`)),
  });
const seqs = () => flattenMessages(qc.getQueryData<MessagePages>(qk.messages("c1"))).map((m) => m.seq);

beforeEach(() => {
  qc = new QueryClient();
});

describe("upsertMessage", () => {
  it("không có cache → no-cache", () => {
    expect(upsertMessage(qc, message({ seq: 1 }))).toBe("no-cache");
  });

  it("tin mới hơn → thêm cuối trang mới nhất", () => {
    seed([{ seqs: [10, 11], hasMore: true }]);
    expect(upsertMessage(qc, message({ seq: 12 }))).toBe("inserted");
    expect(seqs()).toEqual([10, 11, 12]);
  });

  it("trùng _id → thay tại chỗ (không nhân đôi)", () => {
    seed([{ seqs: [10, 11], hasMore: false }]);
    expect(upsertMessage(qc, { ...message({ seq: 11 }), text: "đã sửa" })).toBe("updated");
    expect(seqs()).toEqual([10, 11]);
    expect(flattenMessages(qc.getQueryData<MessagePages>(qk.messages("c1")))[1]?.text).toBe("đã sửa");
  });

  it("đến lệch thứ tự → chèn đúng vị trí theo seq", () => {
    seed([{ seqs: [10, 12], hasMore: false }]);
    upsertMessage(qc, message({ seq: 11 }));
    expect(seqs()).toEqual([10, 11, 12]);
  });

  it("cũ hơn vùng đã tải mà còn trang cũ → bỏ qua (sẽ có khi cuộn lên)", () => {
    seed([
      { seqs: [20, 21], hasMore: true },
      { seqs: [10, 11], hasMore: true },
    ]);
    expect(upsertMessage(qc, message({ seq: 5 }))).toBe("ignored");
    expect(seqs()).toEqual([10, 11, 20, 21]);
  });

  it("tin nằm giữa hai trang đã tải → vào trang cũ hơn chứa nó", () => {
    seed([
      { seqs: [20, 21], hasMore: true },
      { seqs: [10, 11], hasMore: false },
    ]);
    upsertMessage(qc, message({ seq: 15 }));
    expect(seqs()).toEqual([10, 11, 15, 20, 21]);
  });
});

describe("helpers", () => {
  it("asDeleted xoá nội dung giống server", () => {
    const d = asDeleted(
      { ...message({ seq: 1 }), reactions: [{ emoji: "👍", userIds: [ME], count: 1, mine: true }] },
      "2026-10-14T00:00:00Z",
    );
    expect(d).toMatchObject({ text: "", attachments: [], reactions: [], deletedAt: "2026-10-14T00:00:00Z" });
  });

  it("withMyReactions tính lại `mine` cho người xem", () => {
    const m = withMyReactions(
      { ...message({ seq: 1 }), reactions: [{ emoji: "👍", userIds: ["x"], count: 1, mine: true }] },
      ME,
    );
    expect(m.reactions[0]?.mine).toBe(false);
  });
});
