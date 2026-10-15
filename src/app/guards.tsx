import type { ReactNode } from "react";
import { ExternalLink, PanelTop } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { usePermissions, useSession } from "@/core/auth/session";
import { inIframe } from "@/core/embed/bridge";
import { authBase, isEmbeddableRoute, safeNext } from "@/core/lib/navigation";
import { Button, EmptyState } from "@/core/ui/components";
import { FullScreenLoader, ForbiddenPage } from "./pages/status-pages";

/** Chỉ cho vào khi đã đăng nhập; chưa thì về /login?next=<đường dẫn hiện tại>. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const status = useSession((s) => s.status);
  const location = useLocation();
  if (status === "unknown" || status === "loading") return <FullScreenLoader />;
  if (status === "anonymous") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${authBase(location.pathname)}/login?next=${next}`} replace />;
  }
  return children ?? <Outlet />;
}

/** Trang đăng nhập/đăng ký: đã đăng nhập thì chuyển tiếp về `next` (chỉ đường dẫn nội bộ). */
export function GuestOnly({ children }: { children?: ReactNode }) {
  const status = useSession((s) => s.status);
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  if (status === "unknown" || status === "loading") return <FullScreenLoader />;
  if (status === "authenticated") {
    const base = authBase(pathname);
    return <Navigate to={base ? safeNext(params.get("next"), base, base) : safeNext(params.get("next"))} replace />;
  }
  return children ?? <Outlet />;
}

/** Quyền lấy từ bootstrap.permissions (không suy từ roles). */
export function RequirePermission({ permission, children }: { permission: "admin" | "agent"; children?: ReactNode }) {
  const permissions = usePermissions();
  if (!permissions[permission]) return <ForbiddenPage />;
  return children ?? <Outlet />;
}

/**
 * Trong iframe chỉ hiển thị /embed và /widget. CSP frame-ancestors chặn việc TẢI các trang khác vào khung, nhưng điều
 * hướng phía client (link, ?next=, lịch sử) thì không – nên chặn thêm ở đây và mời mở tab mới.
 */
export function FrameGuard() {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  if (!inIframe || isEmbeddableRoute(pathname)) return <Outlet />;
  return (
    <div className="flex h-full items-center justify-center p-4">
      <EmptyState
        icon={<PanelTop />}
        title={t("common.framedTitle")}
        description={t("common.framedBody")}
        action={
          <Button asChild>
            <a href={pathname + search} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              {t("common.openNewTab")}
            </a>
          </Button>
        }
      />
    </div>
  );
}
