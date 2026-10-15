import { create } from "zustand";
import { api, setUnauthorizedHandler } from "@/core/api/http";
import { tokenStore } from "@/core/api/token";
import { transport } from "@/core/api/transport";
import type { AuthResponse, Bootstrap, Id, UserProfile } from "@/core/api/types";
import { describeDevice } from "@/core/lib/device";

// Phiên đăng nhập + dữ liệu khởi động. Nguồn quyền/branding/limits DUY NHẤT là GET /api/me/bootstrap –
// không suy admin/agent từ `roles` (spec §5.1).

export type SessionStatus = "unknown" | "loading" | "authenticated" | "anonymous";

/** Khoá i18n giải thích vì sao bị đưa về màn đăng nhập. */
export type SessionNotice =
  "auth.sessionExpired" | "auth.revokedDisabled" | "auth.revokedLogoutAll" | "auth.loggedOut" | null;

interface SessionState {
  status: SessionStatus;
  bootstrap: Bootstrap | null;
  notice: SessionNotice;
  init: () => Promise<void>;
  login: (body: { email: string; password: string }) => Promise<void>;
  signup: (body: { name: string; email: string; password: string }) => Promise<void>;
  /** Phiên có sẵn token (khách widget sau POST /api/widget/sessions). */
  startWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  /** Xoá phiên cục bộ (401, session.revoked) – không gọi API. */
  expire: (notice: SessionNotice) => void;
  refreshBootstrap: () => Promise<void>;
  setMe: (me: UserProfile) => void;
  setNickname: (userId: Id, nickname: string) => void;
  setBlocked: (userId: Id, blocked: boolean) => void;
  setUnreadTotal: (value: number | ((prev: number) => number)) => void;
  clearNotice: () => void;
}

const fetchBootstrap = () => api.get<Bootstrap>("/api/me/bootstrap", { skipAuthRedirect: true });

export const useSession = create<SessionState>((set, get) => ({
  status: "unknown",
  bootstrap: null,
  notice: null,

  init: async () => {
    if (get().status === "loading") return;
    // Bearer mode mà chưa có token thì chắc chắn chưa đăng nhập – khỏi gọi API.
    if (transport.auth() === "bearer" && !tokenStore.get()) {
      set({ status: "anonymous" });
      return;
    }
    set({ status: "loading" });
    try {
      set({ status: "authenticated", bootstrap: await fetchBootstrap() });
    } catch {
      tokenStore.clear();
      set({ status: "anonymous", bootstrap: null });
    }
  },

  login: async ({ email, password }) => {
    const res = await api.post<AuthResponse>(
      "/api/auth/login",
      { email, password, device: describeDevice() },
      { skipAuthRedirect: true },
    );
    tokenStore.set(res.token);
    set({ status: "authenticated", bootstrap: await fetchBootstrap(), notice: null });
  },

  signup: async ({ name, email, password }) => {
    const res = await api.post<AuthResponse>("/api/auth/signup", { name, email, password }, { skipAuthRedirect: true });
    tokenStore.set(res.token);
    set({ status: "authenticated", bootstrap: await fetchBootstrap(), notice: null });
  },

  startWithToken: async (token) => {
    tokenStore.set(token);
    set({ status: "loading" });
    try {
      set({ status: "authenticated", bootstrap: await fetchBootstrap(), notice: null });
    } catch (error) {
      tokenStore.clear();
      set({ status: "anonymous", bootstrap: null });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout", undefined, { skipAuthRedirect: true });
    } finally {
      get().expire("auth.loggedOut");
    }
  },

  logoutAll: async () => {
    await api.post("/api/auth/logout-all");
    get().expire("auth.revokedLogoutAll");
  },

  expire: (notice) => {
    tokenStore.clear();
    set({ status: "anonymous", bootstrap: null, notice });
  },

  refreshBootstrap: async () => {
    if (get().status !== "authenticated") return;
    set({ bootstrap: await fetchBootstrap() });
  },

  setMe: (me) => set((s) => (s.bootstrap ? { bootstrap: { ...s.bootstrap, me: { ...s.bootstrap.me, ...me } } } : s)),

  setNickname: (userId, nickname) =>
    set((s) => {
      if (!s.bootstrap) return s;
      const nicknames = { ...s.bootstrap.nicknames };
      if (nickname) nicknames[userId] = nickname;
      else delete nicknames[userId];
      return { bootstrap: { ...s.bootstrap, nicknames } };
    }),

  setBlocked: (userId, blocked) =>
    set((s) => {
      if (!s.bootstrap) return s;
      const others = s.bootstrap.blockedUserIds.filter((id) => id !== userId);
      return { bootstrap: { ...s.bootstrap, blockedUserIds: blocked ? [...others, userId] : others } };
    }),

  setUnreadTotal: (value) =>
    set((s) => {
      if (!s.bootstrap) return s;
      const next = typeof value === "function" ? value(s.bootstrap.unreadTotal) : value;
      return { bootstrap: { ...s.bootstrap, unreadTotal: Math.max(0, next) } };
    }),

  clearNotice: () => set({ notice: null }),
}));

// API trả 401 ở bất kỳ đâu (trừ request tự bỏ qua) → hết phiên.
setUnauthorizedHandler(() => {
  if (useSession.getState().status === "authenticated") useSession.getState().expire("auth.sessionExpired");
});

// ---------- selector tiện dụng ----------

export const useMe = () => useSession((s) => s.bootstrap?.me ?? null);
export const usePermissions = () => useSession((s) => s.bootstrap?.permissions ?? NO_PERMISSIONS);
export const useFeatures = () => useSession((s) => s.bootstrap?.features ?? NO_FEATURES);
export const useLimits = () => useSession((s) => s.bootstrap?.limits ?? null);
export const useBranding = () => useSession((s) => s.bootstrap?.branding ?? null);

const NO_PERMISSIONS = { admin: false, agent: false } as const;
const NO_FEATURES = { realtime: false, uploads: false, support: false } as const;

/** Tên hiển thị: biệt danh riêng của tôi (bootstrap.nicknames) ưu tiên hơn tên thật. */
export function useDisplayName(user: { _id: Id; name?: string } | null | undefined): string {
  const nickname = useSession((s) => (user ? s.bootstrap?.nicknames[user._id] : undefined));
  return nickname || user?.name || "";
}

export const displayNameOf = (user: { _id: Id; name?: string } | null | undefined) =>
  (user && useSession.getState().bootstrap?.nicknames[user._id]) || user?.name || "";
