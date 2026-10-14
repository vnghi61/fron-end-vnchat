import { create } from "zustand";
import type { Message } from "@/core/api/types";

/** Một dialog cho cả feed (không tạo dialog theo từng bong bóng): chuyển tiếp, xác nhận xoá. */
interface MessageDialogs {
  forward: Message | null;
  remove: Message | null;
  openForward: (m: Message | null) => void;
  openRemove: (m: Message | null) => void;
}

export const useMessageDialogs = create<MessageDialogs>((set) => ({
  forward: null,
  remove: null,
  openForward: (forward) => set({ forward }),
  openRemove: (remove) => set({ remove }),
}));
