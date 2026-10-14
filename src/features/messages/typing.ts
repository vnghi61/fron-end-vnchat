import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Id, UserBrief } from "@/core/api/types";
import { emitWithAck, onSocketEvent } from "@/core/realtime/socket";

// "Đang nhập": store riêng (không đụng cache tin) để event typing không render lại feed.
// Nhận: tự hết hạn theo `expiresAt` của server. Gửi: typing:true tối đa mỗi ~2.5s (server bỏ lặp trong
// TYPING_THROTTLE_MS=3s), typing:false khi dừng gõ 4s, khi gửi tin hoặc rời hội thoại.

interface TypingEntry {
  user: UserBrief;
  expiresAt: number;
}

interface TypingState {
  byConversation: Record<Id, Record<Id, TypingEntry>>;
  put: (conversationId: Id, user: UserBrief, typing: boolean, expiresAt: number) => void;
  expire: (conversationId: Id, userId: Id) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useTypingStore = create<TypingState>((set, get) => ({
  byConversation: {},
  put: (conversationId, user, typing, expiresAt) => {
    const key = `${conversationId}:${user._id}`;
    clearTimeout(timers.get(key));
    if (!typing) return get().expire(conversationId, user._id);
    set((s) => ({
      byConversation: {
        ...s.byConversation,
        [conversationId]: { ...s.byConversation[conversationId], [user._id]: { user, expiresAt } },
      },
    }));
    timers.set(
      key,
      setTimeout(() => get().expire(conversationId, user._id), Math.max(0, expiresAt - Date.now())),
    );
  },
  expire: (conversationId, userId) =>
    set((s) => {
      const current = s.byConversation[conversationId];
      if (!current?.[userId]) return s;
      const { [userId]: _removed, ...rest } = current;
      return { byConversation: { ...s.byConversation, [conversationId]: rest } };
    }),
}));

export function useTypingUsers(conversationId: Id, meId: Id | undefined): UserBrief[] {
  return useTypingStore(
    useShallow((s) =>
      Object.values(s.byConversation[conversationId] ?? {})
        .filter((e) => e.user._id !== meId)
        .map((e) => e.user),
    ),
  );
}

export function registerTypingHandlers(meId: () => Id | undefined) {
  return onSocketEvent("typing", ({ conversationId, user, typing, expiresAt }) => {
    if (user._id === meId()) return;
    // Đồng hồ máy có thể lệch server: chặn hết hạn trong khoảng 1–10s kể từ lúc nhận.
    const ttl = Math.min(10_000, Math.max(1000, Date.parse(expiresAt) - Date.now() || 6000));
    useTypingStore.getState().put(conversationId, user, typing, Date.now() + ttl);
  });
}

/** Hook phát typing cho composer. */
export function useTypingEmitter(conversationId: Id, enabled: boolean) {
  const lastTrue = useRef(0);
  const active = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    if (!active.current) return;
    active.current = false;
    lastTrue.current = 0;
    void emitWithAck("typing", { conversationId, typing: false });
  }, [conversationId]);

  const ping = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    if (!active.current || now - lastTrue.current > 2500) {
      active.current = true;
      lastTrue.current = now;
      void emitWithAck("typing", { conversationId, typing: true });
    }
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(stop, 4000);
  }, [conversationId, enabled, stop]);

  useEffect(() => stop, [stop]);
  return { ping, stop };
}
