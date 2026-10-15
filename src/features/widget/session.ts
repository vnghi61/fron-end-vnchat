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

/** Trang mà khách đang xem (chỉ origin + path, bỏ query/hash) – gửi vào meta.page của yêu cầu hỗ trợ. */
export function hostPage(): string | undefined {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (!ref || ref.origin === window.location.origin) return undefined;
    return `${ref.origin}${ref.pathname}`.slice(0, 500);
  } catch {
    return undefined;
  }
}
