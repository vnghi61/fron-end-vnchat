import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { Id, Page, UserProfile } from "@/core/api/types";
import { usePresenceStore } from "./presence";

// Tìm người dùng: GET /api/users?q= (khớp đầu từ trong tên không dấu, hoặc đầu email); kết quả có `online`.

export const peopleApi = {
  search: (q: string, limit = 20) => api.get<Page<UserProfile>>("/api/users", { params: { q: q || undefined, limit } }),
  get: (id: Id) => api.get<UserProfile>(path`/api/users/${id}`),
};

export function useUserSearch(q: string, enabled = true) {
  return useQuery({
    queryKey: qk.users(q),
    queryFn: async () => {
      const page = await peopleApi.search(q.trim());
      // kết quả kèm online → ghi vào presence store luôn
      usePresenceStore
        .getState()
        .set(
          page.items
            .filter((u) => u.online !== undefined)
            .map((u) => ({ userId: u._id, online: !!u.online, lastSeenAt: u.lastSeenAt })),
        );
      return page;
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useUser(id: Id | undefined) {
  return useQuery({ queryKey: qk.user(id ?? ""), queryFn: () => peopleApi.get(id!), enabled: !!id, staleTime: 60_000 });
}
