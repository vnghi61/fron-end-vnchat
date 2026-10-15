import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useMatch } from "react-router-dom";
import { useBranding, useSession } from "@/core/auth/session";
import { cn } from "@/core/lib/cn";
import { CountBadge, Tooltip } from "@/core/ui/components";
import { useContainerSize, type PaneSize } from "@/core/ui/hooks";
import { AccountMenu } from "@/features/account/AccountMenu";
import { ProfileSheet } from "@/features/people/ProfileSheet";
import { ConnectionBanner } from "./ConnectionBanner";
import { isNavActive, NAV_ITEMS } from "./nav";
import { ShellContext, type ShellInfo, type ShellVariant } from "@/core/ui/shell";

// Shell của thành viên: full (/app) và compact (/compact – WebView, iframe hẹp).
// Layout theo kích thước CONTAINER: ≥900 có rail trái, nhỏ hơn dùng bottom nav (Chat · Danh bạ · Cài đặt).
// Console hỗ trợ / Admin không nằm trong bottom nav của thành viên (spec §6.3) – vào qua menu tài khoản.

const capFor: Record<ShellVariant, PaneSize> = { full: "xlarge", compact: "large", embed: "large" };
const order: PaneSize[] = ["small", "medium", "large", "xlarge"];
const cap = (size: PaneSize, max: PaneSize) => order[Math.min(order.indexOf(size), order.indexOf(max))] ?? size;

export function AppShell({ variant = "full", base = "/app" }: { variant?: ShellVariant; base?: string }) {
  const { ref, size: measured } = useContainerSize<HTMLDivElement>();
  const size = cap(measured, capFor[variant]);
  const shell = useMemo<ShellInfo>(() => ({ variant, size, base }), [variant, size, base]);
  const wide = size === "large" || size === "xlarge";
  const showRail = wide && variant === "full";
  // Màn chat mở trên màn hẹp chiếm trọn chiều cao (có nút back riêng) → ẩn bottom nav.
  const inConversation = useMatch(`${base}/c/:conversationId/*`);
  const showBottomNav = !showRail && !(inConversation && !wide);

  return (
    <ShellContext.Provider value={shell}>
      <div ref={ref} className="flex h-full w-full flex-col bg-background safe-x">
        <ConnectionBanner />
        <div className="flex min-h-0 flex-1">
          {showRail && <NavRail base={base} />}
          <main className="@container relative min-h-0 min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
        {showBottomNav && <BottomNav base={base} />}
        <ProfileSheet />
      </div>
    </ShellContext.Provider>
  );
}

function useUnreadTotal() {
  return useSession((s) => s.bootstrap?.unreadTotal ?? 0);
}

function NavRail({ base }: { base: string }) {
  const { t } = useTranslation();
  const branding = useBranding();
  const unread = useUnreadTotal();
  const { pathname } = useLocation();
  const appName = branding?.appName || t("common.appName");
  return (
    <nav
      aria-label={t("nav.mainNav")}
      className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-3 safe-top safe-bottom"
    >
      <div
        className="mb-3 flex size-10 items-center justify-center overflow-hidden rounded-md bg-primary text-base font-semibold text-primary-foreground"
        title={appName}
        aria-hidden="true"
      >
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt="" className="size-full object-cover" />
        ) : (
          [...appName][0]?.toUpperCase()
        )}
      </div>
      {NAV_ITEMS.map((item) => {
        const active = isNavActive(item, base, pathname);
        return (
          <Tooltip key={item.to} content={t(item.labelKey)} side="right">
            <Link
              to={`${base}${item.to}`}
              aria-label={t(item.labelKey)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-primary-soft text-primary-strong hover:bg-primary-soft hover:text-primary-strong",
              )}
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.badge === "unread" && (
                <CountBadge
                  count={unread}
                  label={t("nav.unreadCount", { count: unread })}
                  className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]"
                />
              )}
            </Link>
          </Tooltip>
        );
      })}
      <div className="mt-auto">
        <AccountMenu side="right" />
      </div>
    </nav>
  );
}

function BottomNav({ base }: { base: string }) {
  const { t } = useTranslation();
  const unread = useUnreadTotal();
  const { pathname } = useLocation();
  const items = NAV_ITEMS.filter((i) => i.bottom);
  return (
    <nav aria-label={t("nav.mainNav")} className="shrink-0 border-t border-border bg-surface safe-bottom">
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = isNavActive(item, base, pathname);
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={`${base}${item.to}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors",
                  active && "text-primary-strong",
                )}
              >
                <span className="relative">
                  <item.icon className="size-5" aria-hidden="true" />
                  {item.badge === "unread" && (
                    <CountBadge
                      count={unread}
                      label={t("nav.unreadCount", { count: unread })}
                      className="absolute -right-3 -top-1.5 h-4 min-w-4 px-1 text-[10px]"
                    />
                  )}
                </span>
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
