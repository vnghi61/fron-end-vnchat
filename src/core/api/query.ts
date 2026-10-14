import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./errors";

// Server state = TanStack Query. Không retry lỗi 4xx (sai quyền/dữ liệu sẽ sai lại), retry có giới hạn cho mạng/5xx,
// tôn trọng Retry-After của 429.

const shouldRetry = (failureCount: number, error: unknown) => {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return false;
  if (error.isNetwork) return true;
  return error.status >= 500 || error.status === 429;
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        retryDelay: (attempt, error) =>
          error instanceof ApiError && error.retryAfter ? error.retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: false },
    },
  });
}

/** Khoá query tập trung – event router và feature dùng chung để invalidation/patch đúng chỗ. */
export const qk = {
  conversations: (filter: string = "inbox") => ["conversations", filter] as const,
  conversationsAll: ["conversations"] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (conversationId: string) => ["messages", conversationId] as const,
  messagesAll: ["messages"] as const,
  members: (conversationId: string) => ["members", conversationId] as const,
  pins: (conversationId: string) => ["pins", conversationId] as const,
  media: (conversationId: string, kind: string) => ["media", conversationId, kind] as const,
  poll: (id: string) => ["poll", id] as const,
  reminders: (status: string) => ["reminders", status] as const,
  remindersAll: ["reminders"] as const,
  users: (q: string) => ["users", q] as const,
  user: (id: string) => ["user", id] as const,
  presence: ["presence"] as const,
  sessions: ["sessions"] as const,
  blocks: ["blocks"] as const,
  stickers: ["stickers"] as const,
  search: (params: string) => ["search", params] as const,
  supportMine: ["support", "mine"] as const,
  supportQueue: (filter: string) => ["support", "queue", filter] as const,
  supportQueueAll: ["support", "queue"] as const,
  supportStats: ["support", "stats"] as const,
  supportAgents: ["support", "agents"] as const,
  admin: (section: string, params = "") => ["admin", section, params] as const,
};
