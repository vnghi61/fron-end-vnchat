import type {
  Conversation,
  Id,
  ISODate,
  MemberRole,
  Message,
  PrefsResponse,
  Reminder,
  SupportStatus,
  UserBrief,
} from "@/core/api/types";

// Event Socket.IO theo docs/realtime.md §3–4 của backend (tên + payload). Event cũ newMessage/getOnlineUsers không dùng (màn legacy đã gỡ ở Phase 7).

export interface PollEvent {
  pollId: Id;
  conversationId: Id;
  messageId: Id;
  counts: Record<string, number>;
  votersCount: number;
  status: "open" | "closed";
  closedAt?: ISODate;
  closedBy?: Id | null;
}

export interface RoleChange {
  conversationId: Id;
  memberId: Id;
  role: MemberRole;
}

export interface SupportUpdated {
  conversationId: Id;
  status: SupportStatus;
  assigneeId: Id | null;
  tags?: string[];
  rating?: number | null;
  /** Chỉ có ở room `agents` – serialize với viewer null (contract map B2). */
  conversation?: Conversation;
}

export interface ServerEvents {
  ready: (p: { userId: Id }) => void;
  "message.new": (m: Message) => void;
  "message.updated": (m: Message) => void;
  "message.deleted": (p: { conversationId: Id; messageId: Id; seq: number; deletedBy: Id }) => void;
  "reaction.updated": (m: Message) => void;
  "message.pinned": (p: { conversationId: Id; messageId: Id; by: Id; pinnedAt?: ISODate }) => void;
  "message.unpinned": (p: { conversationId: Id; messageId: Id; by: Id }) => void;
  "message.hidden": (p: { conversationId: Id; messageId: Id; hidden: boolean }) => void;
  typing: (p: { conversationId: Id; user: UserBrief; typing: boolean; expiresAt: ISODate }) => void;
  "read.updated": (p: { conversationId: Id; userId: Id; seq: number }) => void;
  "conversation.new": (c: Conversation) => void;
  "conversation.updated": (p: Conversation | RoleChange | PrefsResponse) => void;
  "conversation.member.added": (p: { conversationId: Id; memberIds: Id[]; conversation: Conversation }) => void;
  "conversation.member.removed": (p: { conversationId: Id; memberId: Id }) => void;
  "poll.updated": (p: PollEvent) => void;
  "poll.closed": (p: PollEvent) => void;
  "reminder.created": (p: { reminder: Reminder }) => void;
  "reminder.updated": (p: { reminder: Reminder }) => void;
  "reminder.cancelled": (p: { reminder: Reminder }) => void;
  "reminder.fired": (p: { reminder: Reminder }) => void;
  "user.online": (p: { userId: Id; at: ISODate }) => void;
  "user.offline": (p: { userId: Id; at: ISODate }) => void;
  "block.updated": (p: { userId: Id; blocked: boolean }) => void;
  "nickname.updated": (p: { userId: Id; nickname: string }) => void;
  "session.revoked": (p: { reason: "disabled" | "logout_all" | string }) => void;
  "support.updated": (p: SupportUpdated) => void;
  "support.message": (p: {
    conversationId: Id;
    status: SupportStatus;
    assigneeId: Id | null;
    message: Message;
  }) => void;
}

export type Ack = { ok: true } | { ok: false; code?: string; message?: string };

export interface ClientEvents {
  typing: (p: { conversationId: Id; typing: boolean }, ack: (r: Ack) => void) => void;
  "support:watch": (p: { conversationId: Id }, ack: (r: Ack) => void) => void;
  "support:unwatch": (p: { conversationId: Id }, ack: (r: Ack) => void) => void;
}

export type ServerEventName = keyof ServerEvents;
export type ServerPayload<E extends ServerEventName> = Parameters<ServerEvents[E]>[0];
