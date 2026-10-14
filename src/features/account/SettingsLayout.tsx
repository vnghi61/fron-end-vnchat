import { ChevronRight, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useShell, useShellPath } from "@/core/ui/shell";
import { useSession } from "@/core/auth/session";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { PageHeader } from "@/features/shared/PageHeader";
import { SETTINGS_ENTRIES } from "./settings-entries";

/** Danh sách mục bên trái (màn rộng) hoặc trang danh sách (màn hẹp, khi ở /settings). */
export function SettingsLayout() {
  const { t } = useTranslation();
  const { size } = useShell();
  const to = useShellPath();
  const location = useLocation();
  const wide = size === "large" || size === "xlarge";
  const atIndex = location.pathname.replace(/\/+$/, "") === to("/settings");

  if (!wide && !atIndex) return <Outlet />;

  return (
    <div className="flex h-full">
      <section
        className={cn("flex h-full flex-col border-border bg-surface", wide ? "w-72 shrink-0 border-r" : "w-full")}
      >
        <PageHeader title={t("settings.title")} />
        <nav aria-label={t("settings.title")} className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          <ul className="flex flex-col gap-0.5">
            {SETTINGS_ENTRIES.map((e) => (
              <li key={e.path}>
                <NavLink
                  to={to(e.path)}
                  className={({ isActive }) =>
                    cn(
                      "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-muted",
                      isActive && wide && "bg-primary-soft text-primary-strong hover:bg-primary-soft",
                    )
                  }
                >
                  <e.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1">{t(e.labelKey)}</span>
                  {!wide && <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-4">
            <Button
              variant="danger-ghost"
              block
              className="justify-start gap-3 px-3"
              onClick={() =>
                useSession
                  .getState()
                  .logout()
                  .catch((e: unknown) => toast.error(e))
              }
            >
              <LogOut className="size-5" aria-hidden="true" />
              {t("nav.logout")}
            </Button>
          </div>
        </nav>
      </section>
      {wide && (
        <section className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
          {atIndex ? <Navigate to={to(SETTINGS_ENTRIES[0]?.path ?? "/settings/profile")} replace /> : <Outlet />}
        </section>
      )}
    </div>
  );
}

/** Khung một trang cài đặt: header có nút back ở màn hẹp. */
export function SettingsPage({ title, children }: { title: string; children: ReactNode }) {
  const { size } = useShell();
  const to = useShellPath();
  const wide = size === "large" || size === "xlarge";
  return (
    <div className="flex h-full flex-col">
      {!wide && <PageHeader title={title} backTo={to("/settings")} />}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          {wide && <h1 className="mb-6 text-xl font-semibold">{title}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
