import type { QueryClient } from "@tanstack/react-query";
import { qk } from "@/core/api/query";
import type { Conversation, Id, Message, PrefsResponse } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import type { RoleChange } from "@/core/realtime/events";
import { onSocketEvent } from "@/core/realtime/socket";
import { toast } from "@/core/ui/toast";
import { errorMessage } from "@/core/i18n";
import { ApiError } from "@/core/api/errors";
import { asDeleted, patchMessage, removeMessage, upsertMessage, withMyReactions } from "@/features/messages/cache";
import { previewOf } from "@/features/messages/api";
import { useOutbox } from "@/features/messages/outbox";
import { conversationApi, applyPrefs } from "./api";
import { applyConversation, findConversation, mergeShared, patchConversation, removeConversation } from "./cache";
import { isViewing } from "./ui-store";

// Event router cho hội thoại + tin nhắn (contract map §4). Mọi event realtime đổ vào query cache tại một chỗ.

const meId = () => useSession.getState().bootstrap?.me._id;

const isPrefs = (p: object): p is PrefsResponse => "muted" in p && "conversationId" in p && !("kind" in p);
const isRoleChange = (p: object): p is RoleChange => "memberId" in p && "role" in p && !("kind" in p);

/** Đếm vào unreadTotal? (bootstrap đã loại hội thoại mute/lưu trữ) */
const countsForTotal = (c: Pick<Conversation, "muted" | "archived">) => !c.muted && !c.archived;

let unknownRefetch: ReturnType<typeof setTimeout> | null = null;
function refetchInboxSoon(qc: QueryClient) {
  if (unknownRefetch) return;
  unknownRefetch = setTimeout(() => {
    unknownRefetch = null;
    void qc.invalidateQueries({ queryKey: qk.conversationsAll });
    void useSession
      .getState()
      .refreshBootstrap()
      .catch(() => undefined);
  }, 400);
}

export function onMessageNew(qc: QueryClient, msg: Message) {
  const me = meId();
  upsertMessage(qc, withMyReactions(msg, me));
  if (msg.clientMsgId) useOutbox.getState().remove(msg.conversationId, msg.clientMsgId);

  const mine = msg.senderId === me;
  const viewing = isViewing(msg.conversationId);
  const before = findConversation(qc, msg.conversationId);
  if (!before) {
    refetchInboxSoon(qc); // hội thoại chưa có trong cache (trang cũ / vừa được thêm) → tải lại inbox
    return;
  }
  const isNewer = (before.lastMessage?.seq ?? 0) < msg.seq;
  patchConversation(
    qc,
    msg.conversationId,
    (c) => ({
      ...c,
      lastSeq: Math.max(c.lastSeq, msg.seq),
      lastMessage: isNewer
        ? {
            id: msg._id,
            seq: msg.seq,
            senderId: msg.senderId,
            type: msg.type,
            preview: previewOf(msg),
            deleted: false,
            at: msg.createdAt,
          }
        : c.lastMessage,
      archived: false,
      unreadCount: mine ? 0 : viewing ? c.unreadCount : c.unreadCount + (isNewer ? 1 : 0),
      updatedAt: isNewer ? msg.createdAt : c.updatedAt,
      members: mine
        ? c.members.map((m) => (m.user._id === me ? { ...m, lastReadSeq: Math.max(m.lastReadSeq, msg.seq) } : m))
        : c.members,
    }),
    { toTop: isNewer },
  );
  if (!mine && !viewing && isNewer && !before.muted) {
    // tin mới tự bỏ lưu trữ → hội thoại lưu trữ bắt đầu được tính
    useSession.getState().setUnreadTotal((n) => n + 1 + (before.archived ? before.unreadCount : 0));
  } else if (mine && before.unreadCount > 0 && countsForTotal(before)) {
    useSession.getState().setUnreadTotal((n) => n - before.unreadCount);
  }
}

function onConversationUpdated(qc: QueryClient, payload: Conversation | RoleChange | PrefsResponse) {
  if (isPrefs(payload)) return applyPrefs(qc, payload);
  if (isRoleChange(payload)) {
    const me = meId();
    patchConversation(qc, payload.conversationId, (c) => ({
      ...c,
      myRole: payload.memberId === me ? payload.role : c.myRole,
      members: c.members.map((m) => (m.user._id === payload.memberId ? { ...m, role: payload.role } : m)),
    }));
    void qc.invalidateQueries({ queryKey: qk.members(payload.conversationId) });
    return;
  }
  // Conversation đầy đủ nhưng serialize với viewer null → chỉ merge field dùng chung (B2)
  const existing = findConversation(qc, payload._id);
  if (existing) applyConversation(qc, mergeShared(existing, payload));
  else refetchInboxSoon(qc);
}

function onRemovedFromConversation(qc: QueryClient, conversationId: Id) {
  const before = findConversation(qc, conversationId);
  if (before && before.unreadCount > 0 && countsForTotal(before)) {
    useSession.getState().setUnreadTotal((n) => n - before.unreadCount);
  }
  if (isViewing(conversationId))
    toast.error(errorMessage(new ApiError({ status: 403, code: "CHAT-403-003", message: "" })));
  // ChatView đang mở sẽ tải lại → 403 CHAT-403-003 → hiện trạng thái "không còn là thành viên"
  removeConversation(qc, conversationId);
}

export function registerConversationHandlers(qc: QueryClient) {
  const offs = [
    onSocketEvent("message.new", (m) => onMessageNew(qc, m)),
    onSocketEvent("message.updated", (m) => {
      upsertMessage(qc, withMyReactions(m, meId()));
      patchConversation(qc, m.conversationId, (c) =>
        c.lastMessage?.id === m._id ? { ...c, lastMessage: { ...c.lastMessage, preview: previewOf(m) } } : c,
      );
    }),
    onSocketEvent("reaction.updated", (m) => upsertMessage(qc, withMyReactions(m, meId()))),
    onSocketEvent("message.deleted", ({ conversationId, messageId }) => {
      patchMessage(qc, conversationId, messageId, (m) => asDeleted(m));
      patchConversation(qc, conversationId, (c) =>
        c.lastMessage?.id === messageId ? { ...c, lastMessage: { ...c.lastMessage, deleted: true } } : c,
      );
      void qc.invalidateQueries({ queryKey: qk.pins(conversationId) });
    }),
    onSocketEvent("message.pinned", ({ conversationId, messageId, by, pinnedAt }) => {
      patchMessage(qc, conversationId, messageId, (m) => ({
        ...m,
        pinnedAt: pinnedAt ?? new Date().toISOString(),
        pinnedBy: by,
      }));
      void qc.invalidateQueries({ queryKey: qk.pins(conversationId) });
    }),
    onSocketEvent("message.unpinned", ({ conversationId, messageId }) => {
      patchMessage(qc, conversationId, messageId, (m) => ({ ...m, pinnedAt: null, pinnedBy: undefined }));
      void qc.invalidateQueries({ queryKey: qk.pins(conversationId) });
    }),
    onSocketEvent("message.hidden", ({ conversationId, messageId, hidden }) => {
      if (hidden) removeMessage(qc, conversationId, messageId);
      else void qc.invalidateQueries({ queryKey: qk.messages(conversationId) });
    }),
    onSocketEvent("read.updated", ({ conversationId, userId, seq }) => {
      const me = meId();
      const before = findConversation(qc, conversationId);
      patchConversation(qc, conversationId, (c) => ({
        ...c,
        unreadCount: userId === me ? Math.max(0, Math.min(c.unreadCount, c.lastSeq - seq)) : c.unreadCount,
        members: c.members.map((m) =>
          m.user._id === userId ? { ...m, lastReadSeq: Math.max(m.lastReadSeq, seq) } : m,
        ),
      }));
      if (userId === me && before && countsForTotal(before)) {
        const nextUnread = Math.max(0, Math.min(before.unreadCount, before.lastSeq - seq));
        const delta = before.unreadCount - nextUnread;
        if (delta > 0) useSession.getState().setUnreadTotal((n) => n - delta);
      }
    }),
    onSocketEvent("conversation.new", (c) => {
      qc.setQueryData(qk.conversation(c._id), c);
      applyConversation(qc, c, { toTop: true });
    }),
    onSocketEvent("conversation.updated", (p) => onConversationUpdated(qc, p)),
    onSocketEvent("conversation.member.added", async ({ conversationId, memberIds, conversation }) => {
      const me = meId();
      if (me && memberIds.includes(me)) {
        // Tôi vừa được thêm: payload không có field riêng của tôi → lấy bản đầy đủ
        try {
          const fresh = await conversationApi.get(conversationId);
          qc.setQueryData(qk.conversation(conversationId), fresh);
          applyConversation(qc, fresh, { toTop: true });
        } catch {
          refetchInboxSoon(qc);
        }
        return;
      }
      const existing = findConversation(qc, conversationId);
      if (existing) applyConversation(qc, mergeShared(existing, conversation));
      void qc.invalidateQueries({ queryKey: qk.members(conversationId) });
    }),
    onSocketEvent("conversation.member.removed", ({ conversationId, memberId }) => {
      if (memberId === meId()) return onRemovedFromConversation(qc, conversationId);
      patchConversation(qc, conversationId, (c) => ({
        ...c,
        members: c.members.filter((m) => m.user._id !== memberId),
        memberCount: Math.max(0, c.memberCount - 1),
      }));
      void qc.invalidateQueries({ queryKey: qk.members(conversationId) });
    }),
  ];
  return () => offs.forEach((off) => off());
}
