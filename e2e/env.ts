import { existsSync, readFileSync } from "node:fs";

// Cấu hình E2E: .env.e2e (gitignore, xem .env.e2e.example) rồi biến môi trường (biến môi trường thắng).
// Mật khẩu QA chỉ đọc ở đây – không in ra log, không ghi vào báo cáo.
function load(): Record<string, string> {
  const file = existsSync(".env.e2e")
    ? Object.fromEntries(
        readFileSync(".env.e2e", "utf8")
          .split(/\r?\n/)
          .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
          .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
      )
    : {};
  const fromProcess = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[0].startsWith("E2E_") || e[0] === "QA_PASSWORD"),
  );
  return { ...file, ...fromProcess };
}

export const env = load();
export const BASE = (env.E2E_BASE_URL || "http://localhost:5174").replace(/\/+$/, "");
export const API = (env.E2E_API_URL || "http://localhost:5001").replace(/\/+$/, "");
/** Trang host thử nhúng – phải khác SITE với BASE (127.0.0.1 ≠ localhost). */
export const HOST = (env.E2E_HOST_URL || "http://127.0.0.1:5180").replace(/\/+$/, "");
export const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE);

/** Tài khoản QA: admin (A), hai nhân viên hỗ trợ (B, C). Vai trò: e2e/README.md. */
export const USERS = {
  admin: env.E2E_USER_A ?? "",
  agent: env.E2E_USER_B ?? "",
  agent2: env.E2E_USER_C ?? "",
} as const;
export type Who = keyof typeof USERS;

export const password = () => {
  const value = env.QA_PASSWORD;
  if (!value) throw new Error("Thiếu QA_PASSWORD (đặt trong .env.e2e – xem .env.e2e.example)");
  return value;
};

export const authFile = (who: Who) => `e2e/.auth/${who}.json`;
