import { config, type AuthTransport } from "@/core/config";
import { http } from "./http";
import { tokenStore, type TokenScope } from "./token";

// Cách tài liệu này xác thực. Mặc định theo build (`VITE_AUTH_TRANSPORT`). Tài liệu widget khách chạy "cách ly":
// Bearer với token riêng + KHÔNG cookie. Lý do (contract map B15): POST /api/widget/sessions trả Set-Cookie `jwt` –
// nếu trình duyệt lưu cookie đó, phiên thành viên đang đăng nhập cùng origin API bị thay bằng phiên khách.
// fetch với `credentials: "omit"` không gửi và không lưu cookie, kể cả request cùng origin (XHR thì luôn lưu).

let auth: AuthTransport = config.authTransport;
let cookies = true;

export const transport = {
  auth: () => auth,
  /** Có gửi/lưu cookie không (socket.io dùng để đặt withCredentials). */
  cookies: () => cookies,
};

export const WIDGET_TOKEN_SCOPE: TokenScope = { key: "vnchat.widget.token", area: "local", keep: true };

/** Gọi một lần trước request đầu tiên của tài liệu (main.tsx). */
export function isolateSession(scope: TokenScope) {
  auth = "bearer";
  cookies = false;
  tokenStore.configure(scope);
  http.defaults.adapter = "fetch";
  http.defaults.withCredentials = false; // fetch adapter → credentials: "omit"
}
