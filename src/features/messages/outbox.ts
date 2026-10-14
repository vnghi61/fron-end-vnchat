import { create } from "zustand";
import type { ApiError } from "@/core/api/errors";
import type { Id, ReplyPreview, SendMessageBody } from "@/core/api/types";

// Tin đang gửi / gửi lỗi (optimistic). Mỗi tin có clientMsgId cố định: thử lại dùng lại đúng id đó → backend trả tin cũ
// (200) thay vì tạo bản trùng. Khi response hoặc message.new cùng clientMsgId tới, item bị xoá khỏi outbox.

export interface OutboxItem {
  clientMsgId: string;
  conversationId: Id;
  body: SendMessageBody & { clientMsgId: string };
  status: "sending" | "failed";
  error?: ApiError;
  createdAt: string;
  replyPreview?: ReplyPreview | null;
}

interface OutboxState {
  byConversation: Record<Id, OutboxItem[]>;
  add: (item: OutboxItem) => void;
  update: (conversationId: Id, clientMsgId: string, patch: Partial<OutboxItem>) => void;
  remove: (conversationId: Id, clientMsgId: string) => void;
}

export const useOutbox = create<OutboxState>((set) => ({
  byConversation: {},
  add: (item) =>
    set((s) => ({
      byConversation: {
        ...s.byConversation,
        [item.conversationId]: [...(s.byConversation[item.conversationId] ?? []), item],
      },
    })),
  update: (conversationId, clientMsgId, patch) =>
    set((s) => ({
      byConversation: {
        ...s.byConversation,
        [conversationId]: (s.byConversation[conversationId] ?? []).map((i) =>
          i.clientMsgId === clientMsgId ? { ...i, ...patch } : i,
        ),
      },
    })),
  remove: (conversationId, clientMsgId) =>
    set((s) => {
      const list = s.byConversation[conversationId];
      if (!list?.some((i) => i.clientMsgId === clientMsgId)) return s;
      return {
        byConversation: { ...s.byConversation, [conversationId]: list.filter((i) => i.clientMsgId !== clientMsgId) },
      };
    }),
}));

const EMPTY: OutboxItem[] = [];
export const useConversationOutbox = (conversationId: Id) =>
  useOutbox((s) => s.byConversation[conversationId] ?? EMPTY);
