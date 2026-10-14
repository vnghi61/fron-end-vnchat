import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { Conversation, HistoryVisibility, Id, Page, PrefsResponse } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { toast } from "@/core/ui/toast";
import { applyConversation, filterParams, findConversation, patchConversation, type InboxFilter } from "./cache";

export const conversationApi = {
  list: (filter: InboxFilter, cursor?: string) =>
    api.get<Page<Conversation>>("/api/conversations", {
      params: { limit: filter === "pinned" ? undefined : 30, ...filterParams(filter), cursor },
    }),
  get: (id: Id) => api.get<Conversation>(path`/api/conversations/${id}`),
  createDirect: (userId: Id) => api.post<Conversation>("/api/conversations/direct", { userId }),
  createGroup: (body: { title: string; memberIds: Id[]; historyVisibility?: HistoryVisibility }) =>
    api.post<Conversation>("/api/conversations/group", body),
  mute: (id: Id, minutes: number) => api.post<PrefsResponse>(path`/api/conversations/${id}/mute`, { minutes }),
  pin: (id: Id, pinned: boolean) => api.post<PrefsResponse>(path`/api/conversations/${id}/pin`, { pinned }),
  archive: (id: Id, archived: boolean) => api.post<PrefsResponse>(path`/api/conversations/${id}/archive`, { archived }),
  read: (id: Id, seq?: number) => api.post<void>(path`/api/conversations/${id}/read`, seq === undefined ? {} : { seq }),
};

export function useInbox(filter: InboxFilter, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.conversations(filter),
    queryFn: ({ pageParam }) => conversationApi.list(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    enabled,
  });
}

export function useConversation(id: Id | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.conversation(id ?? ""),
    queryFn: () => conversationApi.get(id!),
    enabled: !!id,
    placeholderData: () => (id ? findConversation(qc, id) : undefined),
    staleTime: 60_000,
  });
}

/** Áp response tuỳ chọn riêng (mute/pin/archive) vào cache. Cũng dùng cho event conversation.updated dạng prefs. */
export function applyPrefs(qc: QueryClient, prefs: PrefsResponse) {
  const { conversationId, ...rest } = prefs;
  const before = findConversation(qc, conversationId);
  patchConversation(qc, conversationId, (c) => ({ ...c, ...rest }));
  // unreadTotal (bootstrap) đã bỏ hội thoại mute/lưu trữ → điều chỉnh khi trạng thái đó đổi
  if (before && before.unreadCount > 0) {
    const counted = (c: { muted: boolean; archived: boolean }) => !c.muted && !c.archived;
    const wasCounted = counted(before);
    const nowCounted = counted({ ...before, ...rest });
    if (wasCounted !== nowCounted) {
      useSession.getState().setUnreadTotal((n) => n + (nowCounted ? before.unreadCount : -before.unreadCount));
    }
  }
}

export type PrefsAction =
  { kind: "pin"; value: boolean } | { kind: "archive"; value: boolean } | { kind: "mute"; minutes: number };

export function usePrefsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: Id; action: PrefsAction }) =>
      action.kind === "pin"
        ? conversationApi.pin(id, action.value)
        : action.kind === "archive"
          ? conversationApi.archive(id, action.value)
          : conversationApi.mute(id, action.minutes),
    onSuccess: (prefs) => applyPrefs(qc, prefs),
    onError: (error) => toast.error(error),
  });
}

/** Mở (hoặc tạo) hội thoại 1-1 rồi ghi vào cache. 201 = mới tạo, 200 = đã có. */
export async function openDirect(qc: QueryClient, userId: Id): Promise<Conversation> {
  const conv = await conversationApi.createDirect(userId);
  qc.setQueryData(qk.conversation(conv._id), conv);
  applyConversation(qc, conv, { toTop: !conv.lastMessage });
  return conv;
}

/** Đánh dấu đã đọc tới tin cuối: cập nhật lạc quan unread của hội thoại + tổng, rồi gọi API. */
export async function markConversationRead(qc: QueryClient, conv: Conversation, meId: Id) {
  const me = conv.members.find((m) => m.user._id === meId);
  if (conv.unreadCount === 0 && (me?.lastReadSeq ?? 0) >= conv.lastSeq) return;
  const unread = conv.unreadCount;
  patchConversation(qc, conv._id, (c) => ({
    ...c,
    unreadCount: 0,
    members: c.members.map((m) =>
      m.user._id === meId ? { ...m, lastReadSeq: Math.max(m.lastReadSeq, c.lastSeq) } : m,
    ),
  }));
  if (unread > 0 && !conv.muted && !conv.archived) useSession.getState().setUnreadTotal((n) => n - unread);
  try {
    await conversationApi.read(conv._id, conv.lastSeq);
  } catch {
    // Không chặn UI: lần mở/đồng bộ sau sẽ đọc lại.
  }
}
