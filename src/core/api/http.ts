import axios, { type AxiosRequestConfig } from "axios";
import { config } from "@/core/config";
import { type ApiError, toApiError } from "./errors";
import { tokenStore } from "./token";

// Một axios instance cho mọi API. Cookie đi kèm (withCredentials) cho chế độ cùng site; Bearer được thêm khi có token.
// Lỗi luôn được chuẩn hoá thành ApiError.

export const http = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true,
  timeout: 20_000,
  headers: { Accept: "application/json" },
});

http.interceptors.request.use((req) => {
  const token = tokenStore.get();
  if (token) req.headers.set("Authorization", `Bearer ${token}`);
  return req;
});

type UnauthorizedListener = (error: ApiError) => void;
let onUnauthorized: UnauthorizedListener | null = null;

/** Session đăng ký để xoá phiên khi API trả 401 (tránh import vòng). */
export function setUnauthorizedHandler(listener: UnauthorizedListener | null) {
  onUnauthorized = listener;
}

http.interceptors.response.use(
  (res) => res,
  (error: unknown) => {
    const apiError = toApiError(error);
    const skip = axios.isAxiosError(error) && (error.config as RequestOptions | undefined)?.skipAuthRedirect;
    if (apiError.isUnauthorized && !skip) onUnauthorized?.(apiError);
    return Promise.reject(apiError);
  },
);

export type RequestOptions = AxiosRequestConfig & {
  /** Không kích hoạt "hết phiên" khi 401 (vd. lần kiểm tra phiên đầu tiên). */
  skipAuthRedirect?: boolean;
};

// Helper gọn: trả thẳng body.
export const api = {
  get: <T>(url: string, options?: RequestOptions) => http.get<T>(url, options).then((r) => r.data),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    http.post<T>(url, body, options).then((r) => r.data),
  put: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    http.put<T>(url, body, options).then((r) => r.data),
  patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    http.patch<T>(url, body, options).then((r) => r.data),
  delete: <T = void>(url: string, options?: RequestOptions) => http.delete<T>(url, options).then((r) => r.data),
};

/** Ghép path an toàn cho tham số động (id, emoji). */
export const path = (strings: TemplateStringsArray, ...values: (string | number)[]) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? encodeURIComponent(String(values[i])) : ""), "");
