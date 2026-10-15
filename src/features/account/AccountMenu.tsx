import { useQueryClient } from "@tanstack/react-query";
import { Headset, LifeBuoy, LogOut, Monitor, Moon, Settings, Shield, Sun, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useFeatures, useMe, usePermissions, useSession } from "@/core/auth/session";
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { useTheme, type ThemePreference } from "@/core/ui/theme";
import { useShellPath } from "@/core/ui/shell";
import { startSupport } from "@/features/support/api";

export function AccountMenu({ side = "right" }: { side?: "right" | "top" | "bottom" }) {
  const { t } = useTranslation();
  const me = useMe();
  const permissions = usePermissions();
  const features = useFeatures();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const to = useShellPath();
  const { preference, setPreference } = useTheme();
  if (!me) return null;

  const nextTheme: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };
  const themeIcon = preference === "dark" ? <Moon /> : preference === "light" ? <Sun /> : <Monitor />;
  const themeLabel = {
    system: t("settings.themeSystem"),
    light: t("settings.themeLight"),
    dark: t("settings.themeDark"),
  }[preference];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full p-0.5 transition-colors hover:bg-muted"
        aria-label={t("nav.openMenu")}
      >
        <Avatar src={me.profileImage} name={me.name} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={side === "right" ? "end" : "end"} className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold text-foreground">{me.name}</span>
          {me.email && <span className="block truncate font-normal">{me.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<UserRound />} onSelect={() => navigate(to("/settings/profile"))}>
          {t("settings.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Settings />} onSelect={() => navigate(to("/settings"))}>
          {t("nav.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={themeIcon}
          onSelect={(e) => {
            e.preventDefault();
            setPreference(nextTheme[preference]);
          }}
        >
          {t("settings.theme")}: {themeLabel}
        </DropdownMenuItem>
        {features.support && (
          <DropdownMenuItem
            icon={<LifeBuoy />}
            onSelect={() => {
              // mở yêu cầu đang mở nếu có (backend trả lại yêu cầu cũ – 200), không tạo trùng
              startSupport(qc)
                .then((c) => navigate(to(`/c/${c._id}`)))
                .catch((e: unknown) => toast.error(e));
            }}
          >
            {t("support.contact")}
          </DropdownMenuItem>
        )}
        {(permissions.agent || permissions.admin) && <DropdownMenuSeparator />}
        {permissions.agent && (
          <DropdownMenuItem icon={<Headset />} onSelect={() => navigate("/support")}>
            {t("nav.agentConsole")}
          </DropdownMenuItem>
        )}
        {permissions.admin && (
          <DropdownMenuItem icon={<Shield />} onSelect={() => navigate("/admin")}>
            {t("nav.admin")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={<LogOut />}
          destructive
          onSelect={() => {
            useSession
              .getState()
              .logout()
              .catch((e: unknown) => toast.error(e));
          }}
        >
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
