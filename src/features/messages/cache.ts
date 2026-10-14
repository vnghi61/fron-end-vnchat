import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { qk } from "@/core/api/query";
import type { Id, Message, Page } from "@/core/api/types";

// Cache tin của một hội thoại = infinite query: pages[0] là trang MỚI NHẤT, các trang sau lùi dần về quá khứ;
// trong mỗi trang `items` cũ → mới (đúng thứ tự backend trả). Dedup theo `_id`, sắp theo `seq`.

export type MessagePages = InfiniteData<Page<Message>, string | undefined>;

/** Danh sách phẳng cũ → mới để render. */
export const flattenMessages = (data: { pages: Page<Message>[] } | undefined): Message[] =>
  data ? [...data.pages].reverse().flatMap((p) => p.items) : [];

const insertSorted = (items: Message[], msg: Message) => {
  const next = [...items];
  let i = next.length;
  while (i > 0 && (next[i - 1]?.seq ?? 0) > msg.seq) i--;
  next.splice(i, 0, msg);
  return next;
};

export type UpsertResult = "updated" | "inserted" | "ignored" | "no-cache";

/** Thêm/thay một tin. Tin cũ hơn vùng đã tải (còn trang cũ chưa tải) bị bỏ qua – sẽ có khi cuộn lên. */
export function upsertMessage(qc: QueryClient, msg: Message): UpsertResult {
  let result: UpsertResult = "no-cache";
  qc.setQueryData<MessagePages>(qk.messages(msg.conversationId), (data) => {
    if (!data) return data;
    // 1) đã có → thay tại chỗ
    for (let p = 0; p < data.pages.length; p++) {
      const page = data.pages[p]!;
      const idx = page.items.findIndex((m) => m._id === msg._id);
      if (idx !== -1) {
        result = "updated";
        const items = [...page.items];
        items[idx] = msg;
        return { ...data, pages: data.pages.map((pg, i) => (i === p ? { ...pg, items } : pg)) };
      }
    }
    // 2) tin mới: chèn vào trang có khoảng seq phù hợp (duyệt từ trang mới nhất)
    for (let p = 0; p < data.pages.length; p++) {
      const page = data.pages[p]!;
      const oldest = page.items[0]?.seq;
      const isLastLoaded = p === data.pages.length - 1;
      if (oldest === undefined || msg.seq >= oldest || (isLastLoaded && !page.hasMore)) {
        result = "inserted";
        return {
          ...data,
          pages: data.pages.map((pg, i) => (i === p ? { ...pg, items: insertSorted(pg.items, msg) } : pg)),
        };
      }
    }
    result = "ignored";
    return data;
  });
  return result;
}

export function patchMessage(qc: QueryClient, conversationId: Id, messageId: Id, patch: (m: Message) => Message) {
  qc.setQueryData<MessagePages>(qk.messages(conversationId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) =>
            p.items.some((m) => m._id === messageId)
              ? { ...p, items: p.items.map((m) => (m._id === messageId ? patch(m) : m)) }
              : p,
          ),
        }
      : data,
  );
}

export function removeMessage(qc: QueryClient, conversationId: Id, messageId: Id) {
  qc.setQueryData<MessagePages>(qk.messages(conversationId), (data) =>
    data
      ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((m) => m._id !== messageId) })) }
      : data,
  );
}

export function findMessage(qc: QueryClient, conversationId: Id, messageId: Id): Message | undefined {
  return flattenMessages(qc.getQueryData<MessagePages>(qk.messages(conversationId))).find((m) => m._id === messageId);
}

/** Bản đã xoá như server trả: text rỗng, bỏ đính kèm/cảm xúc. */
export const asDeleted = (m: Message, at = new Date().toISOString()): Message => ({
  ...m,
  text: "",
  attachments: [],
  image: undefined,
  reactions: [],
  sticker: undefined,
  deletedAt: m.deletedAt ?? at,
  pinnedAt: null,
});

/** `mine` trong payload reaction.updated tính cho người thao tác – tính lại cho người xem hiện tại. */
export const withMyReactions = (m: Message, meId: Id | undefined): Message => ({
  ...m,
  reactions: m.reactions.map((r) => ({ ...r, mine: !!meId && r.userIds.includes(meId) })),
});
