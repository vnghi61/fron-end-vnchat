/**
 * Chặn open-redirect: chỉ nhận path nội bộ bắt đầu bằng "/" (không "//", không scheme). `within` giới hạn thêm vào một
 * khu (vd. "/embed": trong khung nhúng không được nhảy sang /admin bằng điều hướng phía client – CSP không chặn được).
 */
export function safeNext(next: string | null, fallback = "/app", within?: string): string {
  if (!next) return fallback;
  try {
    const decoded = decodeURIComponent(next);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback;
    if (within && !isWithin(decoded, within)) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}

const isWithin = (path: string, area: string) =>
  path === area || path.startsWith(`${area}/`) || path.startsWith(`${area}?`);

/** Route được phép hiển thị khi app nằm trong iframe (khớp CSP frame-ancestors của static host). */
export const isEmbeddableRoute = (pathname: string) => isWithin(pathname, "/embed") || isWithin(pathname, "/widget");

/** Tiền tố trang đăng nhập/đăng ký theo chế độ: trong /embed phải ở dưới /embed (CSP frame-ancestors chỉ mở cho /embed). */
export const authBase = (pathname: string) => (pathname.startsWith("/embed") ? "/embed" : "");
