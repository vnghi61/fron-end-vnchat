import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { usePermissions, useSession } from "@/core/auth/session";
import { safeNext } from "@/core/lib/navigation";
import { FullScreenLoader, ForbiddenPage } from "./pages/status-pages";

/** Chỉ cho vào khi đã đăng nhập; chưa thì về /login?next=<đường dẫn hiện tại>. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const status = useSession((s) => s.status);
  const location = useLocation();
  if (status === "unknown" || status === "loading") return <FullScreenLoader />;
  if (status === "anonymous") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children ?? <Outlet />;
}

/** Trang đăng nhập/đăng ký: đã đăng nhập thì chuyển tiếp về `next` (chỉ đường dẫn nội bộ). */
export function GuestOnly({ children }: { children?: ReactNode }) {
  const status = useSession((s) => s.status);
  const [params] = useSearchParams();
  if (status === "unknown" || status === "loading") return <FullScreenLoader />;
  if (status === "authenticated") return <Navigate to={safeNext(params.get("next"))} replace />;
  return children ?? <Outlet />;
}

/** Quyền lấy từ bootstrap.permissions (không suy từ roles). */
export function RequirePermission({ permission, children }: { permission: "admin" | "agent"; children?: ReactNode }) {
  const permissions = usePermissions();
  if (!permissions[permission]) return <ForbiddenPage />;
  return children ?? <Outlet />;
}
