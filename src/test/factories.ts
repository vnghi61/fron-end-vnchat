import type { Conversation, ConversationMember, Message, UserBrief } from "@/core/api/types";

// Factory dữ liệu đúng contract (types.ts) cho test hội thoại/tin nhắn.

export const ME = "65f000000000000000000001";
export const PEER = "65f000000000000000000002";
export const OTHER = "65f000000000000000000003";

export const user = (id: string, name: string): UserBrief => ({ _id: id, name, profileImage: "", kind: "user" });

export const member = (id: string, name: string, over: Partial<ConversationMember> = {}): ConversationMember => ({
  user: user(id, name),
  role: "member",
  joinedAt: "2026-10-01T00:00:00.000Z",
  lastReadSeq: 0,
  ...over,
});

export const conversation = (over: Partial<Conversation> = {}): Conversation => ({
  _id: "c1",
  kind: "direct",
  title: "Lê Văn Cường",
  avatarUrl: "",
  peer: user(PEER, "Lê Văn Cường"),
  members: [member(ME, "Trần Thị Bình"), member(PEER, "Lê Văn Cường")],
  memberCount: 2,
  lastSeq: 0,
  lastMessage: null,
  unreadCount: 0,
  myRole: "member",
  historyFromSeq: 0,
  muted: false,
  mutedUntil: null,
  mutedForever: false,
  pinned: false,
  pinnedAt: null,
  archived: false,
  createdBy: ME,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

let n = 0;
export const message = (over: Partial<Message> = {}): Message => {
  n += 1;
  const seq = over.seq ?? n;
  return {
    _id: `m${seq}`,
    conversationId: "c1",
    seq,
    senderId: PEER,
    sender: user(PEER, "Lê Văn Cường"),
    type: "text",
    text: `tin ${seq}`,
    attachments: [],
    replyTo: null,
    mentions: [],
    reactions: [],
    links: [],
    editedAt: null,
    deletedAt: null,
    pinnedAt: null,
    createdAt: new Date(Date.UTC(2026, 9, 14, 3, 0, seq)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 9, 14, 3, 0, seq)).toISOString(),
    ...over,
  };
};
