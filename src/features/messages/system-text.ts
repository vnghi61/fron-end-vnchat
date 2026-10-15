import type { Conversation, Id, Message } from "@/core/api/types";
import i18n, { tDynamic } from "@/core/i18n";
import { memberName } from "@/features/conversations/display";

// Câu hiển thị tin hệ thống (type "system", metadata.kind) – bảng §6 docs/ui-features-and-e2e-flows.md của backend.
// Actor = người gửi tin (senderId). Tên lấy từ members của hội thoại (biệt danh ưu tiên); người đã rời hội thoại
// (vd. nhân viên hỗ trợ đã chuyển/trả yêu cầu) lấy từ `known` – SystemMessage tải GET /api/users/:id cho các id đó.

const str = (v: unknown) => (typeof v === "string" ? v : "");
const ids = (v: unknown): Id[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Các user id mà câu hệ thống nhắc tới (để tải tên người không còn trong members). */
export function referencedUserIds(m: Message): Id[] {
  const meta = m.metadata ?? {};
  return [meta.agentId, meta.toAgentId, meta.fromAgentId, meta.memberId, ...ids(meta.memberIds)].filter(
    (x): x is string => typeof x === "string",
  );
}

export function systemText(
  m: Message,
  conv: Conversation | undefined,
  nicknames: Record<Id, string>,
  known: Record<Id, string> = {},
): string {
  const meta = m.metadata ?? {};
  const kind = str(meta.kind) || m.text;
  const name = (id: unknown) => {
    const uid = typeof id === "string" ? id : null;
    const inMembers = !!uid && !!conv?.members.some((mm) => mm.user._id === uid);
    if (uid && !nicknames[uid] && !inMembers && known[uid]) return known[uid];
    return memberName(conv, uid, nicknames);
  };
  const actor = nicknames[m.senderId] || m.sender?.name || name(m.senderId);

  switch (kind) {
    case "group.created":
    case "group.renamed":
      return tDynamic(`system.${kind}`, { actor, title: str(meta.title) });
    case "group.avatar_changed":
      return tDynamic("system.group.avatar_changed", { actor });
    case "group.history_visibility":
      return tDynamic(
        `system.group.history_visibility.${meta.historyVisibility === "since_join" ? "since_join" : "all"}`,
        { actor },
      );
    case "member.added": {
      const names = ids(meta.memberIds).map(name);
      const joined =
        names.length <= 1
          ? (names[0] ?? "")
          : `${names.slice(0, -1).join(", ")} ${i18n.t("system.and")} ${names[names.length - 1]}`;
      return tDynamic("system.member.added", { actor, names: joined });
    }
    case "member.removed":
      return tDynamic("system.member.removed", { actor, name: name(meta.memberId) });
    case "member.left":
      return tDynamic("system.member.left", { name: name(meta.memberId ?? m.senderId) });
    case "member.role_changed": {
      const role = meta.role === "owner" || meta.role === "admin" ? meta.role : "member";
      return tDynamic(`system.member.role_changed.${role}`, { actor, name: name(meta.memberId) });
    }
    case "support.started":
      return str(meta.welcomeMessage) || tDynamic("system.unknown");
    case "support.assigned":
      return tDynamic("system.support.assigned", { name: name(meta.agentId) });
    case "support.transferred": {
      // khách không tra được tên nhân viên đã rời hội thoại (contract map B16) → câu chung thay vì "Ai đó"
      const to = name(meta.toAgentId);
      return to === i18n.t("system.someone")
        ? tDynamic("system.support.transferredGeneric")
        : tDynamic("system.support.transferred", { name: to });
    }
    case "support.released":
    case "support.closed":
    case "support.reopened":
      return tDynamic(`system.${kind}`);
    default:
      return tDynamic("system.unknown");
  }
}
