import type { CommandRule, Id } from "@/core/api/types";

// Gợi ý trong ô soạn: "@tên" → thành viên (mentions[]), "/lệnh" ở đầu tin → commandRules đang bật.
// Server tự nhận lệnh theo regex /^\/([a-z][a-z0-9_-]{0,31})(\s+…)?$/ (src/lib/text.js) – client chỉ gợi ý.

export type SuggestToken = { kind: "mention" | "command"; query: string; start: number; end: number };

/** Bỏ dấu + chữ thường để so khớp "cuong" với "Cường". */
export const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Token đang gõ tại con trỏ (nếu là @… hoặc /… ở đầu tin). */
export function activeToken(text: string, caret: number): SuggestToken | null {
  const before = text.slice(0, caret);
  const command = /^\/([a-z0-9_-]{0,32})$/i.exec(before);
  if (command) return { kind: "command", query: command[1] ?? "", start: 0, end: caret };
  // @ đứng đầu hoặc sau khoảng trắng; truy vấn tối đa 2 từ (tên Việt nhiều từ) và không xuống dòng.
  const mention = /(^|\s)@([^\s@]{0,30}(?: [^\s@]{0,30})?)$/u.exec(before);
  if (mention) {
    const query = mention[2] ?? "";
    return { kind: "mention", query, start: caret - query.length - 1, end: caret };
  }
  return null;
}

export function filterCommands(rules: CommandRule[], query: string, limit = 8): CommandRule[] {
  const q = query.toLowerCase();
  return rules.filter((r) => r.enabled && r.name.toLowerCase().startsWith(q)).slice(0, limit);
}

export interface MentionCandidate {
  id: Id;
  name: string;
  avatar?: string;
}

/** Khớp đầu từ bất kỳ trong tên (bỏ dấu). Truy vấn rỗng → toàn bộ (giới hạn). */
export function filterMembers(candidates: MentionCandidate[], query: string, limit = 8): MentionCandidate[] {
  const q = fold(query.trim());
  if (!q) return candidates.slice(0, limit);
  return candidates
    .filter((c) => {
      const name = fold(c.name);
      return name.startsWith(q) || name.split(/\s+/).some((w) => w.startsWith(q));
    })
    .slice(0, limit);
}

export type Suggestion = { kind: "mention"; item: MentionCandidate } | { kind: "command"; item: CommandRule };

export const suggestionKey = (s: Suggestion) => (s.kind === "mention" ? `m-${s.item.id}` : `c-${s.item.name}`);

/** Thay token bằng giá trị đã chọn; trả về text mới và vị trí con trỏ. */
export function applySuggestion(text: string, token: SuggestToken, insert: string): { text: string; caret: number } {
  const next = `${text.slice(0, token.start)}${insert} ${text.slice(token.end).replace(/^ /, "")}`;
  return { text: next, caret: token.start + insert.length + 1 };
}

/** Chỉ giữ những người được nhắc còn "@Tên" trong nội dung lúc gửi. */
export function collectMentions(text: string, picked: Map<Id, string>): Id[] {
  return [...picked].filter(([, name]) => text.includes(`@${name}`)).map(([id]) => id);
}
