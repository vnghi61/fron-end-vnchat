import { create } from "zustand";
import type { Id, Message } from "@/core/api/types";

// Trạng thái UI của khu chat (không phải server state): hội thoại đang mở, có đang ở cuối feed, chế độ trả lời/sửa.

export type ComposerMode = { kind: "reply"; message: Message } | { kind: "edit"; message: Message } | null;

interface ChatUiState {
  activeId: Id | null;
  atBottom: boolean;
  composer: Record<Id, ComposerMode>;
  drafts: Record<Id, string>;
  setActive: (id: Id | null) => void;
  setAtBottom: (v: boolean) => void;
  setComposerMode: (conversationId: Id, mode: ComposerMode) => void;
  setDraft: (conversationId: Id, text: string) => void;
}

export const useChatUi = create<ChatUiState>((set) => ({
  activeId: null,
  atBottom: true,
  composer: {},
  drafts: {},
  setActive: (activeId) => set({ activeId, atBottom: true }),
  setAtBottom: (atBottom) => set((s) => (s.atBottom === atBottom ? s : { atBottom })),
  setComposerMode: (conversationId, mode) => set((s) => ({ composer: { ...s.composer, [conversationId]: mode } })),
  setDraft: (conversationId, text) => set((s) => ({ drafts: { ...s.drafts, [conversationId]: text } })),
}));

/** Hội thoại đang được người dùng nhìn thấy (mở + tab đang hiện). */
export const isViewing = (conversationId: Id) =>
  useChatUi.getState().activeId === conversationId && document.visibilityState === "visible";
