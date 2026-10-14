import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { qk } from "@/core/api/query";
import { conversation } from "@/test/factories";
import { applyConversation, mergeShared, removeConversation, type ConversationList, type InboxFilter } from "./cache";

let qc: QueryClient;
const seed = (filter: InboxFilter, items: ReturnType<typeof conversation>[], hasMore = false) =>
  qc.setQueryData<ConversationList>(qk.conversations(filter), {
    pages: [{ items, nextCursor: hasMore ? "x" : null, hasMore }],
    pageParams: [undefined],
  });
const ids = (filter: InboxFilter) =>
  qc.getQueryData<ConversationList>(qk.conversations(filter))?.pages.flatMap((p) => p.items.map((c) => c._id));

const c = (id: string, minutesAgo: number, over = {}) =>
  conversation({
    _id: id,
    updatedAt: new Date(Date.UTC(2026, 9, 14, 3, 0) - minutesAgo * 60_000).toISOString(),
    ...over,
  });

beforeEach(() => {
  qc = new QueryClient();
});

describe("applyConversation", () => {
  it("hoạt động mới → lên đầu inbox", () => {
    seed("inbox", [c("a", 1), c("b", 2), c("x", 3)]);
    applyConversation(qc, c("x", 0), { toTop: true });
    expect(ids("inbox")).toEqual(["x", "a", "b"]);
  });

  it("lưu trữ → rời inbox, vào danh sách lưu trữ", () => {
    seed("inbox", [c("a", 1), c("b", 2)]);
    seed("archived", []);
    applyConversation(qc, c("a", 1, { archived: true }));
    expect(ids("inbox")).toEqual(["b"]);
    expect(ids("archived")).toEqual(["a"]);
  });

  it("bộ lọc theo kind chỉ nhận đúng kind", () => {
    seed("kind:group", []);
    applyConversation(qc, c("d", 0), { toTop: true });
    applyConversation(qc, c("g", 0, { kind: "group" }), { toTop: true });
    expect(ids("kind:group")).toEqual(["g"]);
  });

  it("cũ hơn vùng đã tải khi còn trang → không chèn (tránh lệch phân trang)", () => {
    seed("inbox", [c("a", 1), c("b", 2)], true);
    applyConversation(qc, c("old", 100));
    expect(ids("inbox")).toEqual(["a", "b"]);
  });

  it("removeConversation bỏ khỏi mọi danh sách", () => {
    seed("inbox", [c("a", 1), c("b", 2)]);
    seed("pinned", [c("a", 1, { pinned: true, pinnedAt: "2026-10-14T00:00:00Z" })]);
    removeConversation(qc, "a");
    expect(ids("inbox")).toEqual(["b"]);
    expect(ids("pinned")).toEqual([]);
  });
});

describe("mergeShared (payload viewer null – contract map B2)", () => {
  it("chỉ nhận field dùng chung, giữ unread/myRole/prefs của tôi", () => {
    const mine = c("g", 1, { kind: "group", title: "Cũ", unreadCount: 3, myRole: "owner", muted: true, pinned: true });
    const fromEvent = c("g", 0, {
      kind: "group",
      title: "Mới",
      unreadCount: 0,
      myRole: null,
      muted: false,
      pinned: false,
    });
    const merged = mergeShared(mine, fromEvent);
    expect(merged).toMatchObject({ title: "Mới", unreadCount: 3, myRole: "owner", muted: true, pinned: true });
  });
});
