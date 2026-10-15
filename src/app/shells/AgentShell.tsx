import { MessagesSquare } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router-dom";
import { Tooltip } from "@/core/ui/components";
import { useContainerSize } from "@/core/ui/hooks";
import { ShellContext, type ShellInfo } from "@/core/ui/shell";
import { AccountMenu } from "@/features/account/AccountMenu";
import { StatsBar } from "@/features/agent/StatsBar";
import { ConnectionBanner } from "./ConnectionBanner";

/** Shell console hỗ trợ (/support) – chỉ cho người có bootstrap.permissions.agent (guard ở router). */
export function AgentShell() {
  const { t } = useTranslation();
  const { ref, size } = useContainerSize<HTMLDivElement>();
  const shell = useMemo<ShellInfo>(() => ({ variant: "full", size, base: "/support" }), [size]);
  const narrow = size === "small" || size === "medium";
  return (
    <ShellContext.Provider value={shell}>
      <div ref={ref} className="flex h-full w-full flex-col bg-background safe-x">
        <ConnectionBanner />
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 safe-top">
          <Tooltip content={t("agent.backToChats")}>
            <Link
              to="/app"
              aria-label={t("agent.backToChats")}
              className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
            >
              <MessagesSquare className="size-5" aria-hidden="true" />
            </Link>
          </Tooltip>
          <h1 className="shrink-0 text-base font-semibold">{t("agent.title")}</h1>
          <div className="min-w-0 flex-1">{!narrow && <StatsBar />}</div>
          <AccountMenu side="bottom" />
        </header>
        <main className="@container relative min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </ShellContext.Provider>
  );
}
