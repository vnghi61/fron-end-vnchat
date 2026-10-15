import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { ISODate, Page, Session, UserBrief } from "@/core/api/types";

// Thiết bị đăng nhập (§4.1) và danh sách chặn (§4.8). Response blocks chỉ mô tả bằng chữ trong OpenAPI:
// "{ items: [{user, blockedAt}], nextCursor, hasMore }" (controller/social.controller.js).

export interface BlockItem {
  user: UserBrief;
  blockedAt: ISODate;
}

export const accountApi = {
  sessions: () => api.get<Session[]>("/api/auth/sessions"),
  revokeSession: (id: string) => api.delete(path`/api/auth/sessions/${id}`),
  blocks: (cursor?: string) => api.get<Page<BlockItem>>("/api/blocks", { params: { cursor, limit: 50 } }),
  block: (userId: string) => api.post<BlockItem>(path`/api/blocks/${userId}`),
  unblock: (userId: string) => api.delete(path`/api/blocks/${userId}`),
  setNickname: (userId: string, nickname: string) => api.put(path`/api/users/${userId}/nickname`, { nickname }),
  clearNickname: (userId: string) => api.delete(path`/api/users/${userId}/nickname`),
};

export const useSessions = () => useQuery({ queryKey: qk.sessions, queryFn: accountApi.sessions });

export const useBlocks = () =>
  useInfiniteQuery({
    queryKey: qk.blocks,
    queryFn: ({ pageParam }) => accountApi.blocks(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });
