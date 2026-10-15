import { useQuery, type QueryClient } from "@tanstack/react-query";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { Id, Message, Poll } from "@/core/api/types";
import type { PollEvent } from "@/core/realtime/events";
import { onSocketEvent } from "@/core/realtime/socket";
import { upsertMessage } from "@/features/messages/cache";

// Bình chọn (§4.6): tạo đăng tin type=poll; thẻ đọc GET /api/polls/:id; poll.updated/closed chỉ mang số đếm.

export const pollApi = {
  create: (
    conversationId: Id,
    body: {
      question: string;
      options: string[];
      multiple?: boolean;
      anonymous?: boolean;
      closesAt?: string;
      clientMsgId?: string;
    },
  ) => api.post<{ poll: Poll; message: Message }>(path`/api/conversations/${conversationId}/polls`, body),
  get: (id: Id) => api.get<Poll>(path`/api/polls/${id}`),
  vote: (id: Id, optionIds: string[]) => api.put<Poll>(path`/api/polls/${id}/votes`, { optionIds }),
  retract: (id: Id) => api.delete(path`/api/polls/${id}/votes`),
  close: (id: Id) => api.post<Poll>(path`/api/polls/${id}/close`),
};

export function usePoll(id: Id | undefined) {
  return useQuery({ queryKey: qk.poll(id ?? ""), queryFn: () => pollApi.get(id!), enabled: !!id, staleTime: 60_000 });
}

export async function createPoll(qc: QueryClient, conversationId: Id, body: Parameters<typeof pollApi.create>[1]) {
  const { poll, message } = await pollApi.create(conversationId, body);
  qc.setQueryData(qk.poll(poll._id), poll);
  upsertMessage(qc, message);
  return poll;
}

/** Áp số đếm realtime; danh sách người chọn (không ẩn danh) chỉ có khi GET lại → đánh dấu stale. */
function applyPollEvent(qc: QueryClient, e: PollEvent) {
  qc.setQueryData<Poll>(qk.poll(e.pollId), (p) =>
    p
      ? {
          ...p,
          status: e.status,
          votersCount: e.votersCount,
          closedAt: e.closedAt ?? p.closedAt,
          options: p.options.map((o) => ({ ...o, count: e.counts[o.id] ?? o.count })),
        }
      : p,
  );
  void qc.invalidateQueries({ queryKey: qk.poll(e.pollId), refetchType: "none" });
}

export function registerPollHandlers(qc: QueryClient) {
  const offs = [
    onSocketEvent("poll.updated", (e) => applyPollEvent(qc, e)),
    onSocketEvent("poll.closed", (e) => applyPollEvent(qc, e)),
  ];
  return () => offs.forEach((off) => off());
}
