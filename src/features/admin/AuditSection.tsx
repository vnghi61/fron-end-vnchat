import { ScrollText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AuditLog } from "@/core/api/types";
import { formatFull, formatRelative } from "@/core/lib/time";
import { Button, EmptyState, Input, Skeleton } from "@/core/ui/components";
import { useUser } from "@/features/people/api";
import { AdminError, AdminPage } from "./AdminPage";
import { useAudit } from "./api";

/** Nhật ký (màn 24): mới nhất trước, lọc theo hành động / id người thực hiện, tải thêm theo cursor (không có tổng – B11). */
export function AuditSection() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ action: "", actorId: "" });
  const [filters, setFilters] = useState(draft);
  const query = useAudit(filters);
  const logs = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <AdminPage title={t("admin.nav.audit")}>
      <form
        className="mb-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ action: draft.action.trim(), actorId: draft.actorId.trim() });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("admin.audit.action")}</span>
          <Input
            value={draft.action}
            placeholder="user.roles.updated"
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("admin.audit.actor")}</span>
          <Input
            value={draft.actorId}
            className="font-mono"
            onChange={(e) => setDraft((d) => ({ ...d, actorId: e.target.value }))}
          />
        </label>
        <Button type="submit">{t("admin.audit.apply")}</Button>
        {(filters.action || filters.actorId) && (
          <Button
            variant="ghost"
            onClick={() => {
              setDraft({ action: "", actorId: "" });
              setFilters({ action: "", actorId: "" });
            }}
          >
            {t("admin.audit.clear")}
          </Button>
        )}
      </form>
      <p className="mb-4 text-xs text-muted-foreground">{t("admin.audit.noTotal")}</p>
      {query.isPending ? (
        <Skeleton className="h-48 w-full rounded-md" />
      ) : query.isError ? (
        <AdminError error={query.error} onRetry={() => void query.refetch()} />
      ) : logs.length === 0 ? (
        <EmptyState icon={<ScrollText />} title={t("admin.audit.empty")} />
      ) : (
        <ul
          className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface"
          aria-busy={query.isFetching}
        >
          {logs.map((log) => (
            <AuditRow key={log._id} log={log} />
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {t("common.loadMore")}
          </Button>
        </div>
      )}
    </AdminPage>
  );
}

function AuditRow({ log }: { log: AuditLog }) {
  const { t } = useTranslation();
  const actor = useUser(log.actorKind === "user" || !log.actorKind ? log.actorId : undefined);
  const hasMeta = !!log.metadata && Object.keys(log.metadata).length > 0;
  return (
    <li className="p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs font-semibold">{log.action}</span>
        <span className="text-muted-foreground">{actor.data?.name ?? log.actorId ?? t("admin.audit.system")}</span>
        <time
          dateTime={log.createdAt}
          title={formatFull(log.createdAt)}
          className="ml-auto text-xs text-muted-foreground"
        >
          {formatRelative(log.createdAt)}
        </time>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {log.targetType && (
          <>
            {t("admin.audit.target")}:{" "}
            <span className="font-mono">
              {log.targetType}
              {log.targetId ? `:${log.targetId}` : ""}
            </span>
          </>
        )}
        {log.ip && (
          <>
            {" "}
            · {t("admin.audit.ip")} {log.ip}
          </>
        )}
      </p>
      {hasMeta && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-primary-strong">{t("admin.audit.details")}</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded-sm bg-muted p-2 font-mono text-xs scrollbar-thin">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
}
