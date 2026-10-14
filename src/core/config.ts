// Cấu hình build-time (VITE_* là công khai: chỉ URL và allowlist, không bao giờ chứa secret).

export type AuthTransport = "cookie" | "bearer";

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const env = import.meta.env;

export const config = {
  /** Origin API, không có dấu "/" cuối. Rỗng = cùng origin (dev dùng Vite proxy). */
  apiUrl: (env.VITE_API_URL ?? "").replace(/\/+$/, ""),
  authTransport: (env.VITE_AUTH_TRANSPORT === "bearer" ? "bearer" : "cookie") as AuthTransport,
  /** Origin được phép nhúng /embed, /widget và trao đổi postMessage. */
  embedParentOrigins: list(env.VITE_EMBED_PARENT_ORIGINS).filter((o) => /^https?:\/\/[^/]+$/.test(o)),
  isDev: env.DEV,
};
