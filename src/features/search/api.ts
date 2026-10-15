import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { Id, Message, Page } from "@/core/api/types";

// Tìm tin (§4.9): GET /api/messages/search – khớp TỪ NGUYÊN VẸN, bỏ dấu/hoa thường, mới nhất trước, bỏ tin system/đã xoá.
// Tin đã ghim GET /:id/pins và thư viện media GET /:id/media?kind= cũng trả PagedMessages.

export interface SearchParams {
  q?: string;
  conversationId?: Id;
  senderId?: Id;
  type?: string;
  from?: string;
  to?: string;
}

const clean = (p: SearchParams) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>;

function useMessagePages(
  key: readonly unknown[],
  fetcher: (cursor?: string) => Promise<Page<Message>>,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetcher(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useMessageSearch(params: SearchParams, enabled: boolean) {
  const p = clean(params);
  return useMessagePages(
    qk.search(JSON.stringify(p)),
    (cursor) => api.get<Page<Message>>("/api/messages/search", { params: { ...p, cursor, limit: 30 } }),
    enabled,
  );
}

export function usePins(conversationId: Id, enabled = true) {
  return useMessagePages(
    qk.pins(conversationId),
    (cursor) =>
      api.get<Page<Message>>(path`/api/conversations/${conversationId}/pins`, { params: { cursor, limit: 30 } }),
    enabled,
  );
}

export type MediaKind = "image" | "video" | "audio" | "file" | "link";

export function useMedia(conversationId: Id, kind: MediaKind, enabled = true) {
  return useMessagePages(
    qk.media(conversationId, kind),
    (cursor) =>
      api.get<Page<Message>>(path`/api/conversations/${conversationId}/media`, { params: { kind, cursor, limit: 40 } }),
    enabled,
  );
}
