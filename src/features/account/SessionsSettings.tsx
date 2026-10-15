import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { qk } from "@/core/api/query";
import type { Session } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { formatFull, formatRelative } from "@/core/lib/time";
import { Badge, Button, ConfirmDialog, EmptyState, Skeleton } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { accountApi, useSessions } from "./api";
import { SettingsPage } from "./SettingsLayout";

const mobile = /android|iphone|ipad|mobile/i;

/** Thiết bị đăng nhập (màn 22): thu hồi từng phiên (server ngắt socket phiên đó) hoặc đăng xuất mọi nơi. */
export function SessionsSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const sessions = useSessions();
  const [revoking, setRevoking] = useState<Session | null>(null);
  const [all, setAll] = useState(false);

  return (
    <SettingsPage title={t("sessions.title")}>
      {sessions.isPending ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      ) : sessions.isError ? (
        <EmptyState title={errorMessage(sessions.error)} />
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.data.map((s) => {
            const Icon = mobile.test(`${s.device} ${s.userAgent}`) ? Smartphone : Monitor;
            return (
              <li key={s._id} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{s.device || t("sessions.unknownDevice")}</span>
                    {s.current && <Badge tone="primary">{t("sessions.current")}</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={s.lastUsedAt} title={formatFull(s.lastUsedAt)}>
                      {t("sessions.lastUsed", { time: formatRelative(s.lastUsedAt) })}
                    </time>
                    {s.ip && ` · ${t("sessions.ip", { ip: s.ip })}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("sessions.expires", { time: formatFull(s.expiresAt) })}
                  </p>
                </div>
                {!s.current && (
                  <Button variant="ghost" size="sm" onClick={() => setRevoking(s)}>
                    {t("sessions.revoke")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-6 border-t border-border pt-4">
        <Button variant="danger-ghost" onClick={() => setAll(true)}>
          <LogOut aria-hidden="true" />
          {t("sessions.logoutAll")}
        </Button>
      </div>
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t("sessions.revokeConfirm")}
        description={revoking?.device}
        confirmLabel={t("sessions.revoke")}
        onConfirm={async () => {
          if (!revoking) return;
          try {
            await accountApi.revokeSession(revoking._id);
            qc.setQueryData<Session[]>(qk.sessions, (list) => list?.filter((x) => x._id !== revoking._id));
            toast.success(t("sessions.revoked"));
          } catch (error) {
            toast.error(error);
          }
        }}
      />
      <ConfirmDialog
        open={all}
        onOpenChange={setAll}
        title={t("sessions.logoutAllConfirm")}
        description={t("sessions.logoutAllBody")}
        confirmLabel={t("sessions.logoutAll")}
        onConfirm={() => useSession.getState().logoutAll()}
      />
    </SettingsPage>
  );
}
