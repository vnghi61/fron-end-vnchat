/** Chặn open-redirect: chỉ nhận path nội bộ bắt đầu bằng "/" (không "//", không scheme). */
export function safeNext(next: string | null): string {
  if (!next) return "/app";
  try {
    const decoded = decodeURIComponent(next);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) return "/app";
    return decoded;
  } catch {
    return "/app";
  }
}
