import { create } from "zustand";
import type { Id } from "@/core/api/types";

/** Hồ sơ người khác mở dạng sheet từ bất kỳ đâu (danh sách thành viên, header chat, danh bạ). */
export const useProfileSheet = create<{ userId: Id | null; open: (id: Id) => void; close: () => void }>((set) => ({
  userId: null,
  open: (userId) => set({ userId }),
  close: () => set({ userId: null }),
}));
