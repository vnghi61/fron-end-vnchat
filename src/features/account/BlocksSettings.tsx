import { useQueryClient } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { qk } from "@/core/api/query";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { formatRelative } from "@/core/lib/time";
import { Avatar, Button, EmptyState, Skeleton } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { accountApi, useBlocks, type BlockItem } from "./api";
import { SettingsPage } from "./SettingsLayout";

/** Danh sách chặn (màn 22): bỏ chặn ngay tại đây; chặn mới làm từ hồ sơ người dùng. */
export function BlocksSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const blocks = useBlocks();
  const items = blocks.data?.pages.flatMap((p) => p.items) ?? [];

  const unblock = async (b: BlockItem) => {
    try {
      await accountApi.unblock(b.user._id);
      useSession.getState().setBlocked(b.user._id, false);
      void qc.invalidateQueries({ queryKey: qk.blocks });
      toast.success(t("people.unblocked", { name: b.user.name }));
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <SettingsPage title={t("blocks.title")}>
      {blocks.isPending ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : blocks.isError ? (
        <EmptyState title={errorMessage(blocks.error)} />
      ) : !items.length ? (
        <EmptyState icon={<ShieldOff />} title={t("blocks.empty")} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
          {items.map((b) => (
            <li key={b.user._id} className="flex items-center gap-3 p-3">
              <Avatar src={b.user.profileImage} name={b.user.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("blocks.since", { time: formatRelative(b.blockedAt) })}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void unblock(b)}>
                {t("people.unblock")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {blocks.hasNextPage && (
        <Button
          variant="ghost"
          className="mt-3"
          loading={blocks.isFetchingNextPage}
          onClick={() => void blocks.fetchNextPage()}
        >
          {t("common.loadMore")}
        </Button>
      )}
    </SettingsPage>
  );
}
