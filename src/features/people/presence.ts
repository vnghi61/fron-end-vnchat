import { create } from "zustand";
import { api } from "@/core/api/http";
import type { Id, ISODate, Presence } from "@/core/api/types";
import { onSocketEvent } from "@/core/realtime/socket";

// Trạng thái online: snapshot GET /api/presence?ids= (≤200 id/lần) + event user.online/offline (chỉ phát cho contact).
// Store riêng, selector theo từng userId → đổi trạng thái một người không render lại cả danh sách.

interface Entry {
  online: boolean;
  lastSeenAt: ISODate | null;
}

interface PresenceState {
  byUser: Record<Id, Entry>;
  set: (entries: Presence[]) => void;
  mark: (userId: Id, online: boolean, at: ISODate) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  byUser: {},
  set: (entries) =>
    set((s) => {
      const byUser = { ...s.byUser };
      for (const e of entries) byUser[e.userId] = { online: e.online, lastSeenAt: e.lastSeenAt };
      return { byUser };
    }),
  mark: (userId, online, at) =>
    set((s) => ({
      byUser: { ...s.byUser, [userId]: { online, lastSeenAt: online ? (s.byUser[userId]?.lastSeenAt ?? null) : at } },
    })),
}));

export const usePresence = (userId: Id | null | undefined) =>
  usePresenceStore((s) => (userId ? s.byUser[userId] : undefined));

// ---------- gom yêu cầu snapshot ----------

const pending = new Set<Id>();
let timer: ReturnType<typeof setTimeout> | null = null;
const requested = new Set<Id>();

async function flush() {
  timer = null;
  const ids = [...pending];
  pending.clear();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    try {
      usePresenceStore.getState().set(await api.get<Presence[]>("/api/presence", { params: { ids: chunk.join(",") } }));
    } catch {
      chunk.forEach((id) => requested.delete(id)); // cho phép hỏi lại lần sau
    }
  }
}

/** Đảm bảo có snapshot cho các id (gom trong 50ms). `force` = hỏi lại kể cả đã có (sau khi kết nối lại). */
export function ensurePresence(ids: (Id | null | undefined)[], force = false) {
  for (const id of ids) {
    if (!id || (!force && requested.has(id))) continue;
    requested.add(id);
    pending.add(id);
  }
  if (pending.size && !timer) timer = setTimeout(() => void flush(), 50);
}

/** Sau khi kết nối lại: hỏi lại trạng thái mọi người đang theo dõi. */
export const refreshPresence = () => ensurePresence([...requested], true);

export function registerPresenceHandlers() {
  const offs = [
    onSocketEvent("user.online", ({ userId, at }) => usePresenceStore.getState().mark(userId, true, at)),
    onSocketEvent("user.offline", ({ userId, at }) => usePresenceStore.getState().mark(userId, false, at)),
  ];
  return () => offs.forEach((off) => off());
}

/** Dọn khi đăng xuất. */
export function resetPresence() {
  requested.clear();
  pending.clear();
  usePresenceStore.setState({ byUser: {} });
}
