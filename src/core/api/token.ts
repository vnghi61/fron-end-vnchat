import { config } from "@/core/config";
import { storage } from "@/core/lib/storage";

// Token Bearer của tài liệu này (tab/iframe).
// - cookie mode: không giữ token – cookie jwt httpOnly lo xác thực, JWT không nằm trong JS.
// - bearer mode: lưu localStorage của origin hiện tại (bị partition theo site cha khi nằm trong iframe).
// - widget khách: scope riêng trong sessionStorage (features/widget).

export type TokenScope = { key: string | null; area: "local" | "session"; keep: boolean };

export const APP_TOKEN_SCOPE: TokenScope =
  config.authTransport === "bearer"
    ? { key: "vnchat.auth.token", area: "local", keep: true }
    : { key: null, area: "local", keep: false };

let scope: TokenScope = APP_TOKEN_SCOPE;
let memory: string | null = null;

export const tokenStore = {
  /** Đổi nơi lưu token (widget dùng scope riêng). Gọi trước request đầu tiên. */
  configure(next: TokenScope) {
    scope = next;
    memory = null;
  },
  get(): string | null {
    if (memory) return memory;
    if (scope.key) memory = storage.get(scope.key, scope.area);
    return memory;
  },
  set(token: string | null | undefined) {
    if (!token) return tokenStore.clear();
    if (!scope.keep) return;
    memory = token;
    if (scope.key) storage.set(scope.key, token, scope.area);
  },
  clear() {
    memory = null;
    if (scope.key) storage.remove(scope.key, scope.area);
  },
};
