import { keepPreviousData, useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { Conversation, Id, Page, SupportAgent, SupportInfo, SupportStats } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import type { SupportUpdated } from "@/core/realtime/events";
import { onSocketEvent } from "@/core/realtime/socket";
import {
  applyConversation,
  findConversation,
  mergeShared,
  patchConversation,
  removeFromLists,
} from "@/features/conversations/cache";
import { applyQueueConversation, applyQueueMessage, queueKey, queueParams, type QueueFilter } from "./queue";

// Hỗ trợ khách hàng (§4.10/4.11 tài liệu backend). Phía khách: mở / đóng / đánh giá. Phía nhân viên (support:write):
// hàng đợi, thống kê, nhận / chuyển / trả / mở lại / tag. Mọi thay đổi trạng thái đi qua patchSupport để inbox, chi tiết
// và các tab hàng đợi cùng nhất quán.

const conv = (id: Id) => path`/api/support/conversations/${id}`;
const meId = () => useSession.getState().bootstrap?.me._id;

export const supportApi = {
  start: (body: { meta?: Record<string, string>; text?: string }) =>
    api.post<Conversation>("/api/support/conversations", body),
  mine: () => api.get<Conversation[]>("/api/support/conversations/mine"),
  close: (id: Id) => api.post(`${conv(id)}/close`),
  rate: (id: Id, rating: number, note?: string) => api.post(`${conv(id)}/rate`, { rating, note: note || undefined }),
  queue: (filter: QueueFilter, cursor?: string) =>
    api.get<Page<Conversation>>("/api/support/queue", { params: { ...queueParams(filter), cursor, limit: 30 } }),
  stats: () => api.get<SupportStats>("/api/support/stats"),
  agents: () => api.get<SupportAgent[]>("/api/support/agents"),
  assign: (id: Id, agentId?: Id) => api.post<Conversation>(`${conv(id)}/assign`, agentId ? { agentId } : {}),
  transfer: (id: Id, agentId: Id) => api.post<Conversation>(`${conv(id)}/transfer`, { agentId }),
  release: (id: Id) => api.post<Conversation>(`${conv(id)}/release`),
  reopen: (id: Id) => api.post<Conversation>(`${conv(id)}/reopen`),
  tags: (id: Id, tags: string[]) => api.put(`${conv(id)}/tags`, { tags }),
};

// ---------- hooks ----------

export const useMySupport = (enabled = true) =>
  useQuery({ queryKey: qk.supportMine, queryFn: supportApi.mine, enabled, staleTime: 30_000 });

export const useSupportQueue = (filter: QueueFilter) =>
  useInfiniteQuery({
    queryKey: queueKey(filter),
    queryFn: ({ pageParam }) => supportApi.queue(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    placeholderData: keepPreviousData,
  });

export const useSupportStats = () =>
  useQuery({ queryKey: qk.supportStats, queryFn: supportApi.stats, staleTime: 15_000 });

export const useSupportAgents = (enabled: boolean) =>
  useQuery({ queryKey: qk.supportAgents, queryFn: supportApi.agents, enabled, staleTime: 30_000 });

// ---------- cache ----------

/** Response của assign/transfer/release/reopen: serialize theo người gọi → bản đầy đủ, ghi đè mọi nơi. */
export function applySupportConversation(qc: QueryClient, c: Conversation) {
  qc.setQueryData(qk.conversation(c._id), c);
  if (c.myRole !== null) applyConversation(qc, c, { toTop: true });
  else removeFromLists(qc, c._id); // không (còn) là thành viên: chỉ xem từ console, không nằm trong inbox
  applyQueueConversation(qc, c, meId());
  void qc.invalidateQueries({ queryKey: qk.supportStats });
  void qc.invalidateQueries({ queryKey: qk.supportMine });
}

export function patchSupport(qc: QueryClient, id: Id, patch: Partial<SupportInfo>) {
  const next = patchConversation(qc, id, (c) => (c.support ? { ...c, support: { ...c.support, ...patch } } : c));
  if (next) applyQueueConversation(qc, next, meId(), false);
  qc.setQueryData<Conversation[]>(qk.supportMine, (list) =>
    list?.map((c) => (c._id === id && c.support ? { ...c, support: { ...c.support, ...patch } } : c)),
  );
  return next;
}

/** Khách mở yêu cầu (hoặc nhận lại yêu cầu đang mở – 200). */
export async function startSupport(qc: QueryClient, body: Parameters<typeof supportApi.start>[0] = {}) {
  const c = await supportApi.start(body);
  qc.setQueryData(qk.conversation(c._id), c);
  applyConversation(qc, c, { toTop: true });
  void qc.invalidateQueries({ queryKey: qk.supportMine });
  return c;
}

export async function closeSupport(qc: QueryClient, id: Id) {
  await supportApi.close(id);
  patchSupport(qc, id, { status: "closed", closedAt: new Date().toISOString() });
  void qc.invalidateQueries({ queryKey: qk.supportStats });
}

export async function rateSupport(qc: QueryClient, id: Id, rating: number, note?: string) {
  await supportApi.rate(id, rating, note);
  patchSupport(qc, id, { rating, ratingNote: note ?? "" });
}

export async function setSupportTags(qc: QueryClient, id: Id, tags: string[]) {
  await supportApi.tags(id, tags);
  patchSupport(qc, id, { tags });
}

// ---------- realtime ----------

let statsTimer: ReturnType<typeof setTimeout> | null = null;
let queueTimer: ReturnType<typeof setTimeout> | null = null;
const soon = (timer: "stats" | "queue", run: () => void) => {
  if (timer === "stats") {
    if (statsTimer) return;
    statsTimer = setTimeout(() => ((statsTimer = null), run()), 500);
  } else {
    if (queueTimer) return;
    queueTimer = setTimeout(() => ((queueTimer = null), run()), 500);
  }
};

export function applySupportUpdated(qc: QueryClient, p: SupportUpdated) {
  const me = meId();
  if (p.conversation) {
    // room agents: Conversation serialize với viewer null → chỉ merge field dùng chung (B2)
    const existing = findConversation(qc, p.conversationId);
    if (existing) applyConversation(qc, mergeShared(existing, p.conversation));
    applyQueueConversation(qc, p.conversation, me);
  } else {
    const before = findConversation(qc, p.conversationId);
    patchSupport(qc, p.conversationId, {
      status: p.status,
      assigneeId: p.assigneeId,
      ...(p.tags ? { tags: p.tags } : {}),
      ...(p.rating !== undefined ? { rating: p.rating } : {}),
    });
    // room conv: không kèm thông tin người phụ trách → lấy lại để hiện tên
    if (before?.support && before.support.assigneeId !== p.assigneeId)
      void qc.invalidateQueries({ queryKey: qk.conversation(p.conversationId) });
  }
  soon("stats", () => void qc.invalidateQueries({ queryKey: qk.supportStats }));
}

export function registerSupportHandlers(qc: QueryClient) {
  const offs = [
    onSocketEvent("support.updated", (p) => applySupportUpdated(qc, p)),
    onSocketEvent("support.message", ({ conversationId, message }) => {
      if (!applyQueueMessage(qc, conversationId, message, meId()))
        soon("queue", () => void qc.invalidateQueries({ queryKey: qk.supportQueueAll }));
    }),
  ];
  return () => offs.forEach((off) => off());
}
