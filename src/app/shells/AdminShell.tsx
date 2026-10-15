import {
  KeyRound,
  MessagesSquare,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router-dom";
import { cn } from "@/core/lib/cn";
import { Tooltip } from "@/core/ui/components";
import { useContainerSize } from "@/core/ui/hooks";
import { ShellContext, type ShellInfo } from "@/core/ui/shell";
import { AccountMenu } from "@/features/account/AccountMenu";
import { ConnectionBanner } from "./ConnectionBanner";

type AdminNavKey = "users" | "policies" | "settings" | "webhooks" | "apiKeys" | "audit";

const ITEMS: { to: string; key: AdminNavKey; icon: LucideIcon }[] = [
  { to: "users", key: "users", icon: Users },
  { to: "policies", key: "policies", icon: ShieldCheck },
  { to: "settings", key: "settings", icon: Settings2 },
  { to: "webhooks", key: "webhooks", icon: Webhook },
  { to: "api-keys", key: "apiKeys", icon: KeyRound },
  { to: "audit", key: "audit", icon: ScrollText },
];

/**
 * Shell quản trị (/admin) – vào được khi bootstrap.permissions.admin (= admin:principals:read). Các mục khác dùng
 * object quyền riêng nên vẫn hiện trong menu và tự báo "không có quyền" khi API trả 403 (contract map B3).
 */
export function AdminShell() {
  const { t } = useTranslation();
  const { ref, size } = useContainerSize<HTMLDivElement>();
  const shell = useMemo<ShellInfo>(() => ({ variant: "full", size, base: "/admin" }), [size]);
  const wide = size === "large" || size === "xlarge";
  const link = (i: (typeof ITEMS)[number], compact: boolean) => (
    <NavLink
      key={i.to}
      to={`/admin/${i.to}`}
      className={({ isActive }) =>
        cn(
          "flex shrink-0 items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
          compact ? "h-9 px-3 coarse:h-11" : "h-10 px-3",
          isActive
            ? "bg-primary-soft text-primary-strong"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
    >
      <i.icon className="size-4" aria-hidden="true" />
      {t(`admin.nav.${i.key}`)}
    </NavLink>
  );
  return (
    <ShellContext.Provider value={shell}>
      <div ref={ref} className="flex h-full w-full flex-col bg-background safe-x">
        <ConnectionBanner />
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 safe-top">
          <Tooltip content={t("admin.backToChats")}>
            <Link
              to="/app"
              aria-label={t("admin.backToChats")}
              className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
            >
              <MessagesSquare className="size-5" aria-hidden="true" />
            </Link>
          </Tooltip>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{t("admin.title")}</h1>
          <AccountMenu side="bottom" />
        </header>
        <div className={cn("flex min-h-0 flex-1", !wide && "flex-col")}>
          <nav
            aria-label={t("admin.sections")}
            className={
              wide
                ? "flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-2"
                : "flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 scrollbar-thin"
            }
          >
            {ITEMS.map((i) => link(i, !wide))}
          </nav>
          <main className="@container relative min-h-0 min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
