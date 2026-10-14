import type { Conversation, Id, LastMessage, UserBrief } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import i18n, { tDynamic } from "@/core/i18n";

// Hiển thị hội thoại: tên (biệt danh riêng ưu tiên), ảnh, người kia (direct), dòng xem trước.

type Nicknames = Record<Id, string>;

export const peerOf = (conv: Conversation, meId: Id | undefined): UserBrief | null =>
  conv.kind === "direct" ? (conv.peer ?? conv.members.find((m) => m.user._id !== meId)?.user ?? null) : null;

export function conversationTitle(conv: Conversation, meId: Id | undefined, nicknames: Nicknames): string {
  const peer = peerOf(conv, meId);
  if (peer) return nicknames[peer._id] || conv.title || peer.name;
  return conv.title || i18n.t("common.appName");
}

export const conversationAvatar = (conv: Conversation, meId: Id | undefined) =>
  peerOf(conv, meId)?.profileImage || conv.avatarUrl || null;

export function useConversationTitle(conv: Conversation | undefined): string {
  const meId = useSession((s) => s.bootstrap?.me._id);
  const nicknames = useSession((s) => s.bootstrap?.nicknames ?? EMPTY);
  return conv ? conversationTitle(conv, meId, nicknames) : "";
}

const EMPTY: Nicknames = {};

/** Tên một thành viên theo id (biệt danh → tên trong members → "Ai đó"). */
export function memberName(
  conv: Conversation | undefined,
  userId: Id | null | undefined,
  nicknames: Nicknames,
): string {
  if (!userId) return i18n.t("system.someone");
  return nicknames[userId] || conv?.members.find((m) => m.user._id === userId)?.user.name || i18n.t("system.someone");
}

/** Dòng xem trước ở inbox, đã bản địa hoá (preview server viết sẵn tiếng Việt). */
export function previewText(
  last: LastMessage | null,
  conv: Conversation,
  meId: Id | undefined,
  nicknames: Nicknames,
): string {
  if (!last) return i18n.t("inbox.noMessages");
  if (last.deleted) return i18n.t("inbox.preview.deleted");
  let body = last.preview;
  switch (last.type) {
    case "system":
      body = i18n.exists(`system.${last.preview}`) ? i18n.t("inbox.preview.system") : last.preview;
      return body;
    case "sticker":
      body = i18n.t("inbox.preview.sticker", { emoji: last.preview.replace(/^\[Sticker\]\s*/, "") });
      break;
    case "poll":
      body = i18n.t("inbox.preview.poll", { text: last.preview.replace(/^\[Bình chọn\]\s*/, "") });
      break;
    case "file":
      if (last.preview.startsWith("[Hình ảnh]")) body = i18n.t("inbox.preview.image");
      else if (last.preview.startsWith("[Tệp]"))
        body = i18n.t("inbox.preview.file", { name: last.preview.slice(5).trim() });
      break;
    default:
      break;
  }
  if (last.senderId === meId) return `${i18n.t("inbox.you")}: ${body}`;
  if (conv.kind !== "direct") return `${memberName(conv, last.senderId, nicknames)}: ${body}`;
  return body;
}

/** Chữ nhỏ dưới tiêu đề khi không có trạng thái online (nhóm). */
export const membersLabel = (conv: Conversation) => tDynamic("chat.membersCount", { count: conv.memberCount });
