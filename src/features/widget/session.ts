import { api } from "@/core/api/http";
import type { WidgetSession } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { storage } from "@/core/lib/storage";

// Phiên khách widget: POST /api/widget/sessions {name?, email?, visitorToken?} → {user, token, visitorToken}.
// visitorToken giữ ở localStorage (bị partition theo site cha khi nằm trong iframe) để lần sau giữ danh tính + lịch sử.
// Token phiên nằm trong scope riêng của transport cách ly (core/api/transport.ts) – không bao giờ đi qua URL/bridge.

const VISITOR_KEY = "vnchat.widget.visitor";

export const visitorToken = () => storage.get(VISITOR_KEY, "local");

export async function startVisitorSession(body: { name?: string; email?: string } = {}) {
  const res = await api.post<WidgetSession>(
    "/api/widget/sessions",
    { ...body, visitorToken: visitorToken() ?? undefined },
    { skipAuthRedirect: true },
  );
  storage.set(VISITOR_KEY, res.visitorToken, "local");
  await useSession.getState().startWithToken(res.token);
  return res;
}

/**
 * meta của yêu cầu hỗ trợ: `page` = trang khách đang xem (chỉ origin + path), `siteId` = nhãn CÔNG KHAI do loader truyền
 * (data-site-id) để nhân viên biết nguồn – không phải credential (docs/embed-webview-architecture.md §4).
 */
export function supportMeta(): Record<string, string> | undefined {
  const meta: Record<string, string> = {};
  const page = hostPage();
  if (page) meta.page = page;
  const siteId = new URLSearchParams(window.location.search).get("siteId");
  if (siteId && /^[A-Za-z0-9_-]{1,64}$/.test(siteId)) meta.siteId = siteId;
  return Object.keys(meta).length ? meta : undefined;
}

/** Trang mà khách đang xem (chỉ origin + path, bỏ query/hash). */
function hostPage(): string | undefined {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (!ref || ref.origin === window.location.origin) return undefined;
    return `${ref.origin}${ref.pathname}`.slice(0, 500);
  } catch {
    return undefined;
  }
}
