import { useQuery, type QueryClient } from "@tanstack/react-query";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { Conversation, HistoryVisibility, Id, MemberRole, MemberWithPresence } from "@/core/api/types";
import { applyConversation, removeConversation } from "@/features/conversations/cache";
import { usePresenceStore } from "@/features/people/presence";

// Quản lý nhóm (§4.5 tài liệu backend): thành viên, vai trò, đổi tên/ảnh/lịch sử, rời nhóm.

const conv = (id: Id) => path`/api/conversations/${id}`;

export const groupApi = {
  members: (id: Id) => api.get<MemberWithPresence[]>(`${conv(id)}/members`),
  add: (id: Id, memberIds: Id[]) => api.post<Conversation>(`${conv(id)}/members`, { memberIds }),
  remove: (id: Id, userId: Id) => api.delete(`${conv(id)}/members/${encodeURIComponent(userId)}`),
  setRole: (id: Id, userId: Id, role: Exclude<MemberRole, "agent" | "bot">) =>
    api.patch(`${conv(id)}/members/${encodeURIComponent(userId)}`, { role }),
  update: (
    id: Id,
    body: { title?: string; avatar?: string; avatarUrl?: string; historyVisibility?: HistoryVisibility },
  ) => api.patch<Conversation>(conv(id), body),
  leave: (id: Id) => api.post(`${conv(id)}/leave`),
};

/** Thành viên + online (thứ tự server: owner → admin → agent → member → bot). */
export function useMembers(conversationId: Id, enabled = true) {
  return useQuery({
    queryKey: qk.members(conversationId),
    queryFn: async () => {
      const members = await groupApi.members(conversationId);
      usePresenceStore.getState().set(members.map((m) => ({ userId: m.user._id, online: m.online, lastSeenAt: null })));
      return members;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function applyGroup(qc: QueryClient, c: Conversation) {
  qc.setQueryData(qk.conversation(c._id), c);
  applyConversation(qc, c);
  void qc.invalidateQueries({ queryKey: qk.members(c._id) });
}

export async function leaveGroup(qc: QueryClient, id: Id) {
  await groupApi.leave(id);
  removeConversation(qc, id);
}
