// Kiểu domain dùng trong app. Nguồn: api/openapi.yaml của backend (generated/openapi.d.ts) – bản generated để mọi
// field optional vì OpenAPI không khai `required`, nên ở đây khai chặt theo serializer thật (src/lib/serializers.js).
// contract-check.ts bảo đảm mọi field khai ở đây đều có trong OpenAPI (không bịa field).
// Kiểu nào OpenAPI chỉ mô tả bằng chữ thì ghi rõ file controller nguồn.

export type Id = string;
export type ISODate = string;

export type Page<T> = { items: T[]; nextCursor: string | null; hasMore: boolean };

// ---------- users ----------

export type UserKind = "user" | "visitor" | "bot";

export interface UserBrief {
  _id: Id;
  name: string;
  profileImage: string;
  kind: UserKind;
}

export interface UserProfile extends UserBrief {
  /** Chỉ trả cho chính mình hoặc người có quyền admin:principals. */
  email?: string;
  roles?: string[];
  status?: "active" | "inactive";
  online?: boolean;
  lastSeenAt: ISODate | null;
  createdAt: ISODate;
}

/** POST /api/auth/login (200) và /signup (201). */
export interface AuthResponse {
  _id: Id;
  name: string;
  email: string;
  kind: UserKind;
  roles: string[];
  profileImage: string;
  token: string;
}

export interface Session {
  _id: Id;
  device: string;
  userAgent: string;
  ip: string;
  createdAt: ISODate;
  lastUsedAt: ISODate;
  expiresAt: ISODate;
  current: boolean;
}

export interface Presence {
  userId: Id;
  online: boolean;
  lastSeenAt: ISODate | null;
}

// ---------- bootstrap (controller/user.controller.js#bootstrap – OpenAPI để branding/limits là object tự do) ----------

export interface Branding {
  appName: string;
  logoUrl: string;
  primaryColor: string;
}

export interface Limits {
  maxMessageChars: number;
  maxGroupMembers: number;
  maxFileBytes: number;
  allowedMime: string[];
  pollMaxOptions: number;
  forwardMaxTargets: number;
}

export interface CommandRule {
  name: string;
  description: string;
  enabled: boolean;
}

export interface Bootstrap {
  me: UserProfile;
  permissions: { admin: boolean; agent: boolean };
  branding: Branding;
  features: { realtime: boolean; uploads: boolean; support: boolean };
  limits: Limits;
  commandRules: CommandRule[];
  unreadTotal: number;
  nicknames: Record<Id, string>;
  blockedUserIds: Id[];
  serverTime: ISODate;
}

// ---------- messages ----------

export type MessageType = "text" | "file" | "system" | "command" | "sticker" | "poll";
export type AttachmentKind = "image" | "video" | "audio" | "file";

export interface Attachment {
  url: string;
  publicId?: string;
  name?: string;
  size?: number;
  mime?: string;
  kind?: AttachmentKind;
  width?: number;
  height?: number;
}

export interface Reaction {
  emoji: string;
  userIds: Id[];
  count: number;
  mine: boolean;
}

export interface ReplyPreview {
  _id: Id;
  senderId: Id;
  senderName: string;
  type: string;
  text: string;
  hasAttachments: boolean;
  deleted: boolean;
}

export interface Message {
  _id: Id;
  conversationId: Id;
  seq: number;
  senderId: Id;
  sender: UserBrief | null;
  type: MessageType;
  text: string;
  /** Ảnh đầu tiên – field cho client cũ, client mới dùng attachments. */
  image?: string;
  attachments: Attachment[];
  replyTo: Id | null;
  replyPreview?: ReplyPreview | null;
  mentions: Id[];
  command?: { name: string; args: string };
  reactions: Reaction[];
  sticker?: { packId?: string; stickerId?: string; emoji?: string; url?: string };
  pollId?: Id;
  forwardedFrom?: { messageId?: Id; conversationId?: Id; senderId?: Id };
  links: string[];
  /** Tin system: `{ kind, ... }` – docs/realtime.md liệt kê các kind. */
  metadata?: Record<string, unknown>;
  clientMsgId?: string;
  editedAt: ISODate | null;
  deletedAt: ISODate | null;
  pinnedAt: ISODate | null;
  pinnedBy?: Id;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Body POST /api/conversations/:id/messages (SendMessage). */
export interface SendMessageBody {
  type?: "text" | "sticker";
  text?: string;
  clientMsgId?: string;
  replyTo?: Id;
  mentions?: Id[];
  attachments?: { url?: string; publicId?: string; name?: string; size?: number; mime?: string }[];
  sticker?: { packId: string; stickerId: string };
}

export interface ForwardResult {
  conversationId: Id;
  message?: Message;
  error?: { code: string; message: string };
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: { id: string; name: string; emoji: string; url: string }[];
}

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
  maxFileBytes: number;
  allowedMime: string[];
}

// ---------- conversations ----------

export type ConversationKind = "direct" | "group" | "support";
export type MemberRole = "owner" | "admin" | "member" | "agent" | "bot";
export type HistoryVisibility = "all" | "since_join";
export type SupportStatus = "waiting_agent" | "agent" | "closed";

export interface ConversationMember {
  user: UserBrief;
  role: MemberRole;
  joinedAt: ISODate;
  lastReadSeq: number;
}

/** GET /:id/members – thêm `online`. */
export interface MemberWithPresence extends ConversationMember {
  online: boolean;
}

export interface LastMessage {
  id: Id;
  seq: number;
  senderId: Id;
  type: MessageType;
  preview: string;
  deleted: boolean;
  at: ISODate;
}

export interface SupportInfo {
  status: SupportStatus;
  assigneeId: Id | null;
  assignee: UserBrief | null;
  customer: (UserBrief & { contactEmail?: string }) | null;
  tags: string[];
  meta: Record<string, string>;
  assignedAt: ISODate | null;
  closedAt: ISODate | null;
  rating: number | null;
  ratingNote: string | null;
}

export interface ConversationPrefs {
  muted: boolean;
  mutedUntil: ISODate | null;
  mutedForever: boolean;
  pinned: boolean;
  pinnedAt: ISODate | null;
  archived: boolean;
}

export interface Conversation extends ConversationPrefs {
  _id: Id;
  kind: ConversationKind;
  title: string;
  avatarUrl: string;
  /** Chỉ direct: người kia. */
  peer?: UserBrief | null;
  historyVisibility?: HistoryVisibility;
  members: ConversationMember[];
  memberCount: number;
  lastSeq: number;
  lastMessage: LastMessage | null;
  unreadCount: number;
  myRole: MemberRole | null;
  historyFromSeq: number;
  support?: SupportInfo;
  createdBy: Id | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Response mute/pin/archive và event conversation.updated dạng tuỳ chọn riêng. */
export interface PrefsResponse extends ConversationPrefs {
  conversationId: Id;
}

// ---------- polls & reminders ----------

export interface PollOption {
  id: string;
  text: string;
  count: number;
  /** Không có khi bình chọn ẩn danh. */
  voters?: UserBrief[];
}

export interface Poll {
  _id: Id;
  conversationId: Id;
  messageId: Id;
  question: string;
  options: PollOption[];
  multiple: boolean;
  anonymous: boolean;
  status: "open" | "closed";
  closesAt: ISODate | null;
  closedAt: ISODate | null;
  votersCount: number;
  myOptionIds: string[];
  createdBy: Id;
}

export type ReminderStatus = "scheduled" | "fired" | "cancelled";

export interface Reminder {
  _id: Id;
  note: string;
  remindAt: ISODate;
  remindAtLocal: string;
  timezone: string;
  status: ReminderStatus;
  conversationId: Id | null;
  messageId: Id | null;
  firedAt: ISODate | null;
}

// ---------- support ----------

/** GET /api/support/stats */
export interface SupportStats {
  waiting_agent: number;
  agent: number;
  closed: number;
  mineOpen: number;
  averageRating: number | null;
  rated: number;
}

/** GET /api/support/agents – controller/support.controller.js#listAgents */
export interface SupportAgent extends UserBrief {
  online: boolean;
}

export interface WidgetSession {
  user: UserBrief;
  token: string;
  visitorToken: string;
  welcomeMessage: string;
}

// ---------- admin (controller/admin.controller.js – OpenAPI chỉ mô tả bằng chữ) ----------

export interface PolicyRule {
  sub: string;
  obj: string;
  act: "read" | "write" | "*";
}

export interface PoliciesResponse {
  rules: PolicyRule[];
  objects: string[];
  actions: PolicyRule["act"][];
}

export interface AdminSettings {
  branding: Branding;
  commandRules: CommandRule[];
  stickerPacks: StickerPack[];
  widget: { enabled: boolean; welcomeMessage: string };
  updatedAt: ISODate | null;
}

export interface Webhook {
  _id: Id;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdBy: Id;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface WebhookDelivery {
  _id: Id;
  event: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastStatusCode?: number | null;
  lastError?: string | null;
  deliveredAt?: ISODate | null;
  createdAt: ISODate;
}

export interface ApiKey {
  _id: Id;
  name: string;
  prefix: string;
  scopes: string[];
  status: "active" | "revoked";
  expiresAt: ISODate | null;
  lastUsedAt: ISODate | null;
  botUserId: Id | null;
  createdBy: Id;
  createdAt: ISODate;
  revokedAt: ISODate | null;
}

export interface AuditLog {
  _id: Id;
  actorId?: Id;
  actorKind?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: ISODate;
}
