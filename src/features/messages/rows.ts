import type { ConversationMember, Id, Message } from "@/core/api/types";
import type { OutboxItem } from "./outbox";

// Dựng danh sách hàng cho feed (thuần, có unit test): phân cách ngày, vạch "tin mới", gộp cụm tin liên tiếp cùng người
// gửi (≤ 5 phút, cùng ngày), tin đang gửi của outbox ở cuối (bỏ những tin đã có bản thật cùng clientMsgId).

export type FeedRow =
  | { kind: "start"; key: "start" }
  | { kind: "day"; key: string; at: string }
  | { kind: "unread"; key: "unread" }
  | { kind: "message"; key: string; message: Message; mine: boolean; groupStart: boolean; groupEnd: boolean }
  | { kind: "system"; key: string; message: Message }
  | { kind: "pending"; key: string; item: OutboxItem };

const GROUP_GAP_MS = 5 * 60_000;
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function buildRows(
  messages: Message[],
  outbox: OutboxItem[],
  meId: Id | undefined,
  /** seq tôi đã đọc lúc MỞ hội thoại (cố định trong phiên xem) – vạch "tin mới" đặt trước tin đầu tiên lớn hơn. */
  unreadAfterSeq: number | null,
): FeedRow[] {
  const rows: FeedRow[] = [];
  let lastDay = "";
  let unreadPlaced = false;
  const confirmedClientIds = new Set(messages.map((m) => m.clientMsgId).filter(Boolean));

  messages.forEach((m, i) => {
    const day = dayKey(m.createdAt);
    if (day !== lastDay) {
      rows.push({ kind: "day", key: `day-${day}`, at: m.createdAt });
      lastDay = day;
    }
    if (!unreadPlaced && unreadAfterSeq !== null && m.seq > unreadAfterSeq && m.senderId !== meId) {
      rows.push({ kind: "unread", key: "unread" });
      unreadPlaced = true;
    }
    if (m.type === "system") {
      rows.push({ kind: "system", key: m._id, message: m });
      return;
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const sameGroup = (a: Message | undefined, b: Message) =>
      !!a &&
      a.type !== "system" &&
      a.senderId === b.senderId &&
      dayKey(a.createdAt) === dayKey(b.createdAt) &&
      Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) <= GROUP_GAP_MS;
    rows.push({
      kind: "message",
      key: m._id,
      message: m,
      mine: m.senderId === meId,
      groupStart: !sameGroup(prev, m),
      groupEnd: !next || !sameGroup(m, next) || (unreadAfterSeq !== null && !unreadPlaced && next.seq > unreadAfterSeq),
    });
  });

  const pending = outbox.filter((o) => !confirmedClientIds.has(o.clientMsgId));
  if (pending.length) {
    const today = dayKey(new Date().toISOString());
    if (today !== lastDay) rows.push({ kind: "day", key: `day-${today}`, at: new Date().toISOString() });
    pending.forEach((item) => rows.push({ kind: "pending", key: `out-${item.clientMsgId}`, item }));
  }
  return rows;
}

/**
 * "Đã xem": với mỗi thành viên khác, gắn họ vào tin MỚI NHẤT (trong vùng đã tải) mà họ đã đọc tới (seq ≤ lastReadSeq).
 * Trả map messageId → danh sách thành viên. Direct: chỉ cần biết tin cuối của tôi đã được đọc chưa.
 */
export function readersByMessage(
  messages: Message[],
  members: ConversationMember[],
  meId: Id | undefined,
): Map<Id, ConversationMember[]> {
  const map = new Map<Id, ConversationMember[]>();
  const visible = messages.filter((m) => m.type !== "system");
  for (const member of members) {
    if (member.user._id === meId || member.lastReadSeq <= 0) continue;
    let target: Message | undefined;
    for (let i = visible.length - 1; i >= 0; i--) {
      const m = visible[i]!;
      if (m.seq <= member.lastReadSeq) {
        target = m;
        break;
      }
    }
    if (!target) continue;
    const list = map.get(target._id) ?? [];
    list.push(member);
    map.set(target._id, list);
  }
  return map;
}
