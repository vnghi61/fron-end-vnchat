import { useQueryClient } from "@tanstack/react-query";
import { AlarmClock, MessageSquare, MoreHorizontal, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Reminder, ReminderStatus } from "@/core/api/types";
import { errorMessage, tDynamic } from "@/core/i18n";
import { formatFull, formatRelative } from "@/core/lib/time";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/core/ui/components";
import { ActionDropdown } from "@/core/ui/components/action-menu";
import { useShellPath } from "@/core/ui/shell";
import { toast } from "@/core/ui/toast";
import { PageHeader } from "@/features/shared/PageHeader";
import { applyReminder, reminderApi, useReminders } from "./api";
import { ReminderDialog } from "./ReminderDialog";

const STATUSES: ReminderStatus[] = ["scheduled", "fired", "cancelled"];

/** Danh sách nhắc việc (màn 13): sắp tới / đã nhắc / đã huỷ. Realtime reminder.* cập nhật cache (registerReminderHandlers). */
export function RemindersPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ReminderStatus>("scheduled");
  const [editing, setEditing] = useState<Reminder | "new" | null>(null);
  const [cancelling, setCancelling] = useState<Reminder | null>(null);
  const qc = useQueryClient();
  const query = useReminders(status);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex h-full flex-col bg-background">
      <PageHeader
        title={t("reminders.title")}
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            {t("reminders.new")}
          </Button>
        }
      />
      <Tabs value={status} onValueChange={(v) => setStatus(v as ReminderStatus)}>
        <TabsList className="bg-surface px-2">
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {tDynamic(`reminders.status.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin" aria-busy={query.isFetching}>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 p-3">
          {query.isPending ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)
          ) : query.isError ? (
            <EmptyState
              title={errorMessage(query.error)}
              action={
                <Button variant="secondary" onClick={() => void query.refetch()}>
                  {t("common.retry")}
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState icon={<AlarmClock />} title={tDynamic(`reminders.empty.${status}`)} />
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((r) => (
                <ReminderRow key={r._id} reminder={r} onEdit={() => setEditing(r)} onCancel={() => setCancelling(r)} />
              ))}
            </ul>
          )}
          {query.hasNextPage && (
            <Button
              variant="ghost"
              className="self-center"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t("common.loadMore")}
            </Button>
          )}
        </div>
      </div>
      {editing && (
        <ReminderDialog reminder={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title={t("reminders.cancelConfirm")}
        description={cancelling?.note}
        confirmLabel={t("reminders.cancel")}
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await reminderApi.cancel(cancelling._id);
            applyReminder(qc, { ...cancelling, status: "cancelled" });
            toast.success(t("reminders.cancelled"));
          } catch (error) {
            toast.error(error);
          }
        }}
      />
    </div>
  );
}

function ReminderRow({
  reminder: r,
  onEdit,
  onCancel,
}: {
  reminder: Reminder;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const to = useShellPath();
  const scheduled = r.status === "scheduled";
  return (
    <li className="flex gap-3 rounded-md border border-border bg-surface p-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong"
      >
        <AlarmClock className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-sm font-medium">{r.note}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <time dateTime={r.remindAt} title={r.timezone}>
            {formatFull(r.remindAt)}
          </time>
          {scheduled && ` · ${formatRelative(r.remindAt)}`}
        </p>
        {r.conversationId && r.messageId && (
          <Link
            to={`${to(`/c/${r.conversationId}`)}?msg=${r.messageId}`}
            className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-primary-strong underline-offset-4 hover:underline coarse:min-h-11"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            {t("reminders.open")}
          </Link>
        )}
      </div>
      {scheduled && (
        <ActionDropdown
          items={[
            { key: "edit", label: t("reminders.edit"), icon: <Pencil />, onSelect: onEdit },
            { key: "cancel", label: t("reminders.cancel"), icon: <X />, destructive: true, onSelect: onCancel },
          ]}
          trigger={<IconButton label={t("message.actions")} icon={<MoreHorizontal />} size="sm" />}
        />
      )}
    </li>
  );
}
