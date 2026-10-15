import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { qk } from "@/core/api/query";
import type { Conversation, Id, Message, Page, SupportStatus } from "@/core/api/types";
import { previewOf } from "@/features/messages/api";

// Hàng đợi console hỗ trợ: GET /api/support/queue (updatedAt giảm dần, cursor). Event `support.updated` (room agents,
// kèm conversation) và `support.message` cập nhật mọi tab đang có trong cache theo đúng bộ lọc của tab đó.

export type QueueTab = "waiting" | "mine" | "agent" | "closed" | "all";
export const QUEUE_TABS: QueueTab[] = ["waiting", "mine", "agent", "closed", "all"];

export type QueueFilter = { tab: QueueTab; tag: string };
export type QueueList = InfiniteData<Page<Conversation>, string | undefined>;

export const queueKey = (f: QueueFilter) => qk.supportQueue(`${f.tab}|${f.tag}`);

const parseKey = (key: readonly unknown[]): QueueFilter => {
  const [tab = "waiting", tag = ""] = String(key[2] ?? "").split("|");
  return { tab: tab as QueueTab, tag };
};

/** Tham số query backend cho một tab ("mine" = các yêu cầu đang mở của tôi). */
export function queueParams({ tab, tag }: QueueFilter): Record<string, string> {
  const params: Record<string, string> =
    tab === "waiting"
      ? { status: "waiting_agent" }
      : tab === "mine"
        ? { status: "open", mine: "true" }
        : tab === "agent"
          ? { status: "agent" }
          : tab === "closed"
            ? { status: "closed" }
            : { status: "all" };
  if (tag) params.tag = tag;
  return params;
}

export function matchesQueue(c: Conversation, { tab, tag }: QueueFilter, meId: Id | undefined): boolean {
  if (c.kind !== "support" || !c.support) return false;
  if (tag && !c.support.tags.includes(tag)) return false;
  const status: SupportStatus = c.support.status;
  switch (tab) {
    case "waiting":
      return status === "waiting_agent";
    case "mine":
      return status !== "closed" && !!meId && c.support.assigneeId === meId;
    case "agent":
      return status === "agent";
    case "closed":
      return status === "closed";
    default:
      return true;
  }
}

/** Thêm/thay/xoá một yêu cầu ở mọi tab đang cache; `toTop` khi vừa có hoạt động. */
export function applyQueueConversation(qc: QueryClient, conv: Conversation, meId: Id | undefined, toTop = true) {
  for (const query of qc.getQueryCache().findAll({ queryKey: qk.supportQueueAll })) {
    const filter = parseKey(query.queryKey);
    qc.setQueryData<QueueList>(query.queryKey, (data) => {
      if (!data) return data;
      const pages = data.pages.map((p) => ({ ...p, items: p.items.filter((c) => c._id !== conv._id) }));
      if (!matchesQueue(conv, filter, meId)) return { ...data, pages };
      const first = pages[0];
      if (!first) return { ...data, pages: [{ items: [conv], nextCursor: null, hasMore: false }] };
      if (toTop) first.items.unshift(conv);
      else {
        const at = first.items.findIndex((c) => Date.parse(c.updatedAt) < Date.parse(conv.updatedAt));
        first.items.splice(at === -1 ? first.items.length : at, 0, conv);
      }
      return { ...data, pages };
    });
  }
}

export function findQueueConversation(qc: QueryClient, id: Id): Conversation | undefined {
  for (const [, data] of qc.getQueriesData<QueueList>({ queryKey: qk.supportQueueAll })) {
    const found = data?.pages.flatMap((p) => p.items).find((c) => c._id === id);
    if (found) return found;
  }
  return undefined;
}

/** support.message: cập nhật preview/thời gian và đưa yêu cầu lên đầu các tab đang chứa nó. */
export function applyQueueMessage(qc: QueryClient, conversationId: Id, message: Message, meId: Id | undefined) {
  const current = findQueueConversation(qc, conversationId);
  if (!current) return false;
  applyQueueConversation(
    qc,
    {
      ...current,
      lastSeq: Math.max(current.lastSeq, message.seq),
      lastMessage: {
        id: message._id,
        seq: message.seq,
        senderId: message.senderId,
        type: message.type,
        preview: previewOf(message),
        deleted: false,
        at: message.createdAt,
      },
      updatedAt: message.createdAt,
    },
    meId,
  );
  return true;
}

/** Người xem là khách của yêu cầu này (không phải nhân viên đang xử lý / xem). */
export const isSupportCustomer = (c: Conversation, meId: Id | undefined) =>
  !!meId && c.kind === "support" && (c.support?.customer?._id === meId || c.createdBy === meId);
