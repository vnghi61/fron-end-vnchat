import { keepPreviousData, useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type {
  AdminSettings,
  ApiKey,
  AuditLog,
  Id,
  Page,
  PoliciesResponse,
  PolicyRule,
  UserProfile,
  Webhook,
  WebhookDelivery,
} from "@/core/api/types";

// Quản trị (§4.12 tài liệu backend). Mỗi mục có object quyền riêng (admin:principals/webhooks/settings/audit/api_keys/
// policies) – bootstrap chỉ cho biết admin:principals:read (B3) nên từng mục tự xử lý 403 (AdminSection).
// Secret webhook / API key chỉ có trong response tạo mới: KHÔNG ghi vào query cache, chỉ hiện một lần.

export type UserFilters = { q: string; kind: string; status: string; role: string };
export type AdminRole = "admin" | "agent" | "member";

const clean = (p: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v)) as Record<string, string>;

export const adminApi = {
  users: (f: UserFilters, cursor?: string) =>
    api.get<Page<UserProfile>>("/api/admin/users", { params: { ...clean(f), cursor, limit: 50 } }),
  setRoles: (id: Id, roles: AdminRole[]) => api.put<UserProfile>(path`/api/admin/users/${id}/roles`, { roles }),
  setStatus: (id: Id, status: "active" | "inactive") =>
    api.put<UserProfile>(path`/api/admin/users/${id}/status`, { status }),

  policies: () => api.get<PoliciesResponse>("/api/admin/policies"),
  savePolicies: (rules: PolicyRule[]) => api.put<PoliciesResponse>("/api/admin/policies", { rules }),

  settings: () => api.get<AdminSettings>("/api/admin/settings"),
  saveSettings: (patch: Partial<AdminSettings>) => api.put<AdminSettings>("/api/admin/settings", patch),

  webhooks: () => api.get<{ items: Webhook[]; events: string[] }>("/api/admin/webhooks"),
  createWebhook: (body: WebhookBody) => api.post<{ webhook: Webhook; secret: string }>("/api/admin/webhooks", body),
  updateWebhook: (id: Id, body: WebhookBody) => api.put<Webhook>(path`/api/admin/webhooks/${id}`, body),
  deleteWebhook: (id: Id) => api.delete(path`/api/admin/webhooks/${id}`),
  deliveries: (id: Id) => api.get<WebhookDelivery[]>(path`/api/admin/webhooks/${id}/deliveries`),
  redeliver: (deliveryId: Id) => api.post(path`/api/admin/webhooks/deliveries/${deliveryId}/redeliver`),

  apiKeys: () => api.get<{ items: ApiKey[]; scopes: string[] }>("/api/admin/api-keys"),
  createApiKey: (body: { name: string; scopes: string[]; expiresAt?: string }) =>
    api.post<{ apiKey: ApiKey; key: string }>("/api/admin/api-keys", body),
  revokeApiKey: (id: Id) => api.delete(path`/api/admin/api-keys/${id}`),

  audit: (f: { action: string; actorId: string }, cursor?: string) =>
    api.get<Page<AuditLog>>("/api/admin/audit", { params: { ...clean(f), cursor, limit: 50 } }),
};

export interface WebhookBody {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  enabled?: boolean;
}

export const useAdminUsers = (f: UserFilters) =>
  useInfiniteQuery({
    queryKey: qk.admin("users", JSON.stringify(f)),
    queryFn: ({ pageParam }) => adminApi.users(f, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    placeholderData: keepPreviousData,
  });

export const usePolicies = () => useQuery({ queryKey: qk.admin("policies"), queryFn: adminApi.policies });
export const useAdminSettings = () => useQuery({ queryKey: qk.admin("settings"), queryFn: adminApi.settings });
export const useWebhooks = () => useQuery({ queryKey: qk.admin("webhooks"), queryFn: adminApi.webhooks });
export const useDeliveries = (id: Id | null) =>
  useQuery({
    queryKey: qk.admin("deliveries", id ?? ""),
    queryFn: () => adminApi.deliveries(id!),
    enabled: !!id,
  });
export const useApiKeys = () => useQuery({ queryKey: qk.admin("api-keys"), queryFn: adminApi.apiKeys });
export const useAudit = (f: { action: string; actorId: string }) =>
  useInfiniteQuery({
    queryKey: qk.admin("audit", JSON.stringify(f)),
    queryFn: ({ pageParam }) => adminApi.audit(f, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    placeholderData: keepPreviousData,
  });

/** Sau khi đổi người dùng: thay bản ghi trong mọi trang danh sách đang cache. */
export function applyAdminUser(qc: QueryClient, user: UserProfile) {
  for (const query of qc.getQueryCache().findAll({ queryKey: ["admin", "users"] })) {
    qc.setQueryData<{ pages: Page<UserProfile>[]; pageParams: unknown[] }>(query.queryKey, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((p) => ({ ...p, items: p.items.map((u) => (u._id === user._id ? user : u)) })),
          }
        : data,
    );
  }
}
