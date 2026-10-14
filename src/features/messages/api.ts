import { useInfiniteQuery, type QueryClient } from "@tanstack/react-query";
import { toApiError } from "@/core/api/errors";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { Conversation, ForwardResult, Id, Message, Page, ReplyPreview, SendMessageBody } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { uuid } from "@/core/lib/id";
import { patchConversation } from "@/features/conversations/cache";
import { asDeleted, patchMessage, removeMessage, upsertMessage, withMyReactions } from "./cache";
import { useOutbox } from "./outbox";

const base = (conversationId: Id) => path`/api/conversations/${conversationId}/messages`;
const one = (conversationId: Id, messageId: Id) => path`/api/conversations/${conversationId}/messages/${messageId}`;

export const PAGE_SIZE = 50;

export const messageApi = {
  page: (conversationId: Id, before?: string) =>
    api.get<Page<Message>>(base(conversationId), { params: { limit: PAGE_SIZE, before } }),
  send: (conversationId: Id, body: SendMessageBody) => api.post<Message>(base(conversationId), body),
  edit: (conversationId: Id, messageId: Id, text: string) =>
    api.patch<Message>(one(conversationId, messageId), { text }),
  remove: (conversationId: Id, messageId: Id) => api.delete(one(conversationId, messageId)),
  react: (conversationId: Id, messageId: Id, emoji: string) =>
    api.post<Message>(`${one(conversationId, messageId)}/reactions`, { emoji }),
  unreact: (conversationId: Id, messageId: Id, emoji: string) =>
    api.delete<Message>(`${one(conversationId, messageId)}/reactions/${encodeURIComponent(emoji)}`),
  pin: (conversationId: Id, messageId: Id) => api.post<Message>(`${one(conversationId, messageId)}/pin`),
  unpin: (conversationId: Id, messageId: Id) => api.delete(`${one(conversationId, messageId)}/pin`),
  hide: (conversationId: Id, messageId: Id) => api.post(`${one(conversationId, messageId)}/hide`),
  unhide: (conversationId: Id, messageId: Id) => api.delete(`${one(conversationId, messageId)}/hide`),
  forward: (conversationId: Id, messageId: Id, conversationIds: Id[]) =>
    api.post<{ results: ForwardResult[] }>(`${one(conversationId, messageId)}/forward`, { conversationIds }),
};

/** Trang tin: trang đầu là mới nhất; "trang tiếp" = cũ hơn (?before=). Socket + /api/sync giữ cache tươi. */
export function useMessages(conversationId: Id) {
  return useInfiniteQuery({
    queryKey: qk.messages(conversationId),
    queryFn: ({ pageParam }) => messageApi.page(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 10 * 60_000,
  });
}

/** Cập nhật hội thoại sau khi có tin mới của chính mình (đưa lên đầu, bỏ lưu trữ, đã đọc tới tin này). */
export function noteOwnMessage(qc: QueryClient, msg: Message, meId: Id) {
  patchConversation(
    qc,
    msg.conversationId,
    (c) => ({
      ...c,
      lastSeq: Math.max(c.lastSeq, msg.seq),
      lastMessage:
        (c.lastMessage?.seq ?? 0) > msg.seq
          ? c.lastMessage
          : {
              id: msg._id,
              seq: msg.seq,
              senderId: msg.senderId,
              type: msg.type,
              preview: previewOf(msg),
              deleted: false,
              at: msg.createdAt,
            },
      archived: false,
      unreadCount: 0,
      updatedAt: msg.createdAt,
      members: c.members.map((m) =>
        m.user._id === meId ? { ...m, lastReadSeq: Math.max(m.lastReadSeq, msg.seq) } : m,
      ),
    }),
    { toTop: true },
  );
}

/** Preview tạm phía client (giống messagePreview của backend) cho tới khi server gửi lastMessage thật. */
export function previewOf(m: Pick<Message, "type" | "text" | "attachments" | "sticker" | "deletedAt">): string {
  if (m.deletedAt) return "Tin nhắn đã bị xoá";
  if (m.type === "sticker") return `[Sticker] ${m.sticker?.emoji ?? ""}`.trim();
  if (m.type === "poll") return `[Bình chọn] ${m.text}`;
  if (m.type === "system") return m.text;
  if (m.text) return [...m.text].slice(0, 120).join("");
  const first = m.attachments[0];
  if (first) return first.kind === "image" ? "[Hình ảnh]" : `[Tệp] ${first.name ?? ""}`.trim();
  return "";
}

/** Gửi tin qua outbox (optimistic). Trả về clientMsgId. */
export function sendMessage(
  qc: QueryClient,
  conversationId: Id,
  body: SendMessageBody,
  opts: { replyPreview?: ReplyPreview | null } = {},
): string {
  const clientMsgId = body.clientMsgId ?? uuid();
  useOutbox.getState().add({
    clientMsgId,
    conversationId,
    body: { ...body, clientMsgId },
    status: "sending",
    createdAt: new Date().toISOString(),
    replyPreview: opts.replyPreview,
  });
  void deliver(qc, conversationId, clientMsgId);
  return clientMsgId;
}

/** Gửi lại một tin lỗi – CÙNG clientMsgId (backend trả 200 + tin cũ nếu lần trước thực ra đã tới). */
export function retryMessage(qc: QueryClient, conversationId: Id, clientMsgId: string) {
  useOutbox.getState().update(conversationId, clientMsgId, { status: "sending", error: undefined });
  void deliver(qc, conversationId, clientMsgId);
}

async function deliver(qc: QueryClient, conversationId: Id, clientMsgId: string) {
  const item = useOutbox.getState().byConversation[conversationId]?.find((i) => i.clientMsgId === clientMsgId);
  if (!item) return;
  try {
    const msg = await messageApi.send(conversationId, item.body);
    upsertMessage(qc, msg);
    const meId = useSession.getState().bootstrap?.me._id;
    if (meId) noteOwnMessage(qc, msg, meId);
    useOutbox.getState().remove(conversationId, clientMsgId);
  } catch (error) {
    useOutbox.getState().update(conversationId, clientMsgId, { status: "failed", error: toApiError(error) });
  }
}

// ---------- thao tác trên tin ----------

export async function editMessage(qc: QueryClient, conversationId: Id, messageId: Id, text: string) {
  const msg = await messageApi.edit(conversationId, messageId, text);
  upsertMessage(qc, withMyReactions(msg, useSession.getState().bootstrap?.me._id));
  return msg;
}

export async function deleteMessage(qc: QueryClient, conversationId: Id, messageId: Id) {
  await messageApi.remove(conversationId, messageId);
  patchMessage(qc, conversationId, messageId, (m) => asDeleted(m));
}

/** Bật/tắt một cảm xúc của tôi (lạc quan, hoàn tác khi lỗi). */
export async function toggleReaction(qc: QueryClient, message: Message, emoji: string) {
  const meId = useSession.getState().bootstrap?.me._id;
  if (!meId) return;
  const mine = message.reactions.some((r) => r.emoji === emoji && r.userIds.includes(meId));
  const optimistic: Message = {
    ...message,
    reactions: mine
      ? message.reactions
          .map((r) =>
            r.emoji === emoji
              ? { ...r, userIds: r.userIds.filter((id) => id !== meId), count: r.count - 1, mine: false }
              : r,
          )
          .filter((r) => r.count > 0)
      : message.reactions.some((r) => r.emoji === emoji)
        ? message.reactions.map((r) =>
            r.emoji === emoji ? { ...r, userIds: [...r.userIds, meId], count: r.count + 1, mine: true } : r,
          )
        : [...message.reactions, { emoji, userIds: [meId], count: 1, mine: true }],
  };
  upsertMessage(qc, optimistic);
  try {
    const res = mine
      ? await messageApi.unreact(message.conversationId, message._id, emoji)
      : await messageApi.react(message.conversationId, message._id, emoji);
    upsertMessage(qc, withMyReactions(res, meId));
  } catch (error) {
    upsertMessage(qc, message);
    throw error;
  }
}

export async function setPinned(qc: QueryClient, message: Message, pinned: boolean) {
  if (pinned)
    upsertMessage(
      qc,
      withMyReactions(
        await messageApi.pin(message.conversationId, message._id),
        useSession.getState().bootstrap?.me._id,
      ),
    );
  else {
    await messageApi.unpin(message.conversationId, message._id);
    patchMessage(qc, message.conversationId, message._id, (m) => ({ ...m, pinnedAt: null, pinnedBy: undefined }));
  }
  void qc.invalidateQueries({ queryKey: qk.pins(message.conversationId) });
}

export async function hideMessage(qc: QueryClient, message: Message) {
  await messageApi.hide(message.conversationId, message._id);
  removeMessage(qc, message.conversationId, message._id);
}

export async function unhideMessage(qc: QueryClient, message: Message) {
  await messageApi.unhide(message.conversationId, message._id);
  upsertMessage(qc, message);
}

export async function forwardMessage(qc: QueryClient, message: Message, targets: Conversation[]) {
  const { results } = await messageApi.forward(
    message.conversationId,
    message._id,
    targets.map((c) => c._id),
  );
  const meId = useSession.getState().bootstrap?.me._id;
  for (const r of results) {
    if (r.message) {
      upsertMessage(qc, r.message);
      if (meId) noteOwnMessage(qc, r.message, meId);
    }
  }
  return results;
}
