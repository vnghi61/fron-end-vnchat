// Giao thức bridge v1 giữa trang host và VNChat chạy trong iframe / WebView (docs/embed-webview-architecture.md §3).
// Đây là giao thức PHÍA FRONTEND – backend không tham gia. Mọi thứ ở đây là hàm thuần để unit test được.

export type HostToChat =
  | { source: "vnchat-host"; v: 1; type: "theme:set"; theme: "light" | "dark" | "system" }
  | { source: "vnchat-host"; v: 1; type: "locale:set"; locale: "vi" | "en" }
  | { source: "vnchat-host"; v: 1; type: "navigate"; route: string }
  | { source: "vnchat-host"; v: 1; type: "viewport:set"; height: number }
  | { source: "vnchat-host"; v: 1; type: "open" | "close" };

export type ChatToHost =
  | { type: "ready" }
  | { type: "resize"; height: number }
  | { type: "unread:change"; count: number }
  | { type: "open" | "close" }
  /** Widget không khả dụng (CHAT-403-001) – loader ẩn hẳn launcher. */
  | { type: "hide" }
  | { type: "navigate:external"; url: string };

export type OutgoingMessage = ChatToHost & { source: "vnchat-embed"; v: 1 };

const ROUTE = /^\/(embed|widget)(\/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&_%.-]*)?$/;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/** Kiểm tra shape + giá trị (§3.1 bước 2–3). Sai bất kỳ điều kiện → null (bỏ qua im lặng). */
export function parseHostMessage(data: unknown): HostToChat | null {
  if (!isRecord(data) || data.source !== "vnchat-host" || data.v !== 1) return null;
  switch (data.type) {
    case "theme:set":
      return data.theme === "light" || data.theme === "dark" || data.theme === "system"
        ? { source: "vnchat-host", v: 1, type: "theme:set", theme: data.theme }
        : null;
    case "locale:set":
      return data.locale === "vi" || data.locale === "en"
        ? { source: "vnchat-host", v: 1, type: "locale:set", locale: data.locale }
        : null;
    case "navigate":
      return typeof data.route === "string" && ROUTE.test(data.route) && !data.route.includes("..") && !data.route.includes("//")
        ? { source: "vnchat-host", v: 1, type: "navigate", route: data.route }
        : null;
    case "viewport:set":
      return typeof data.height === "number" && Number.isFinite(data.height) && data.height >= 0 && data.height <= 10_000
        ? { source: "vnchat-host", v: 1, type: "viewport:set", height: Math.round(data.height) }
        : null;
    case "open":
    case "close":
      return { source: "vnchat-host", v: 1, type: data.type };
    default:
      return null;
  }
}

/** Origin hợp lệ dạng `https://host[:port]` (không path, không wildcard). */
export const isOrigin = (v: string) => /^https?:\/\/[^/\s*]+$/.test(v);

/**
 * Origin trang cha (§2): ancestorOrigins[0] (Chromium/WebKit) hoặc origin của referrer; CHỈ nhận nếu nằm trong allowlist
 * cấu hình lúc deploy. Không tin `?origin=`/`?parent=`. Không xác định được → null (chạy bình thường, tắt bridge).
 */
export function resolveParentOrigin(input: {
  allowlist: readonly string[];
  ancestorOrigins?: readonly string[] | null;
  referrer?: string;
}): string | null {
  const candidates: string[] = [];
  if (input.ancestorOrigins?.length) candidates.push(input.ancestorOrigins[0]!);
  else if (input.referrer) {
    try {
      candidates.push(new URL(input.referrer).origin);
    } catch {
      /* referrer hỏng → không có ứng viên */
    }
  }
  const origin = candidates[0];
  return origin && isOrigin(origin) && input.allowlist.includes(origin) ? origin : null;
}

/** Chỉ cho mở URL http(s) tuyệt đối ra ngoài (navigate:external). */
export function safeExternalUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
