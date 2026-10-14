import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { qk } from "@/core/api/query";
import type { Conversation, Id, Page } from "@/core/api/types";

// Cache hội thoại: nhiều danh sách (inbox, theo kind, lưu trữ, ghim) + bản chi tiết. Mọi cập nhật từ event/mutation
// đi qua đây để các danh sách luôn nhất quán (đúng bộ lọc, đúng thứ tự, không trùng).

export type ConversationList = InfiniteData<Page<Conversation>, string | undefined>;

export type InboxFilter = "inbox" | "kind:direct" | "kind:group" | "kind:support" | "archived" | "pinned";

export const INBOX_FILTERS: InboxFilter[] = ["inbox", "kind:direct", "kind:group", "kind:support", "archived"];

export function filterParams(filter: InboxFilter): Record<string, string> {
  if (filter === "archived") return { archived: "true" };
  if (filter === "pinned") return { pinned: "true" };
  if (filter.startsWith("kind:")) return { kind: filter.slice(5) };
  return {};
}

export function matchesFilter(conv: Conversation, filter: InboxFilter): boolean {
  switch (filter) {
    case "inbox":
      return !conv.archived;
    case "archived":
      return conv.archived;
    case "pinned":
      return conv.pinned;
    default:
      return !conv.archived && conv.kind === filter.slice(5);
  }
}

const sortKey = (filter: InboxFilter) => (c: Conversation) =>
  filter === "pinned" ? Date.parse(c.pinnedAt ?? "") || 0 : Date.parse(c.updatedAt) || 0;

const flatten = (data: ConversationList | undefined) => data?.pages.flatMap((p) => p.items) ?? [];

/** Lấy bản mới nhất đang có của một hội thoại (chi tiết hoặc bất kỳ danh sách nào). */
export function findConversation(qc: QueryClient, id: Id): Conversation | undefined {
  const detail = qc.getQueryData<Conversation>(qk.conversation(id));
  if (detail) return detail;
  for (const [, data] of qc.getQueriesData<ConversationList>({ queryKey: qk.conversationsAll })) {
    const found = flatten(data).find((c) => c._id === id);
    if (found) return found;
  }
  return undefined;
}

function filterOf(queryKey: readonly unknown[]): InboxFilter {
  return (queryKey[1] as InboxFilter | undefined) ?? "inbox";
}

/**
 * Ghi một hội thoại vào mọi danh sách: thêm/thay/xoá theo bộ lọc của từng danh sách.
 * `toTop`: hội thoại vừa có hoạt động – đưa lên đầu (đã cập nhật updatedAt) kể cả khi chưa có trong danh sách.
 */
export function applyConversation(qc: QueryClient, conv: Conversation, { toTop = false } = {}) {
  qc.setQueryData<Conversation>(qk.conversation(conv._id), (old) => (old ? conv : old));
  for (const query of qc.getQueryCache().findAll({ queryKey: qk.conversationsAll })) {
    const filter = filterOf(query.queryKey);
    qc.setQueryData<ConversationList>(query.queryKey, (data) => {
      if (!data) return data;
      const exists = data.pages.some((p) => p.items.some((c) => c._id === conv._id));
      const keep = matchesFilter(conv, filter);
      if (!keep && !exists) return data;
      // Bỏ khỏi chỗ cũ rồi chèn lại đúng thứ tự giảm dần (vào trang chứa khoảng thời gian tương ứng).
      const pages = data.pages.map((p) => ({ ...p, items: p.items.filter((c) => c._id !== conv._id) }));
      if (!keep) return { ...data, pages };
      const key = sortKey(filter);
      const value = toTop ? Number.POSITIVE_INFINITY : key(conv);
      for (const page of pages) {
        const at = page.items.findIndex((c) => key(c) < value);
        if (at !== -1) {
          page.items.splice(at, 0, conv);
          return { ...data, pages };
        }
      }
      // Cũ hơn mọi phần tử đã tải: chỉ thêm cuối khi đã tải hết (nếu còn trang, nó sẽ tới khi cuộn).
      const last = pages[pages.length - 1];
      if (!last) return { ...data, pages: [{ items: [conv], nextCursor: null, hasMore: false }] };
      if (!last.hasMore) last.items.push(conv);
      return { ...data, pages };
    });
  }
}

/** Sửa một hội thoại ở mọi nơi (không làm gì nếu chưa có trong cache). */
export function patchConversation(
  qc: QueryClient,
  id: Id,
  patch: (c: Conversation) => Conversation,
  opts?: { toTop?: boolean },
) {
  const current = findConversation(qc, id);
  if (!current) return undefined;
  const next = patch(current);
  qc.setQueryData<Conversation>(qk.conversation(id), (old) => (old ? patch(old) : old));
  applyConversation(qc, next, opts);
  return next;
}

export function removeConversation(qc: QueryClient, id: Id) {
  qc.removeQueries({ queryKey: qk.conversation(id) });
  qc.removeQueries({ queryKey: qk.messages(id) });
  for (const query of qc.getQueryCache().findAll({ queryKey: qk.conversationsAll })) {
    qc.setQueryData<ConversationList>(query.queryKey, (data) =>
      data ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((c) => c._id !== id) })) } : data,
    );
  }
}

/** Field dùng chung (không phụ thuộc người xem) – dùng khi payload được serialize với viewer null (contract map B2). */
const SHARED_FIELDS = [
  "title",
  "avatarUrl",
  "historyVisibility",
  "members",
  "memberCount",
  "lastSeq",
  "lastMessage",
  "support",
  "updatedAt",
] as const;

export function mergeShared(existing: Conversation, incoming: Conversation): Conversation {
  const next = { ...existing };
  for (const field of SHARED_FIELDS) {
    if (incoming[field] !== undefined) (next as Record<string, unknown>)[field] = incoming[field];
  }
  // direct: tiêu đề/ảnh server tính theo người xem – payload viewer null có thể sai, giữ bản cũ
  if (existing.kind === "direct") {
    next.title = existing.title;
    next.avatarUrl = existing.avatarUrl;
  }
  return next;
}
