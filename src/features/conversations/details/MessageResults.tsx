import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Message, Page } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { formatShortTime } from "@/core/lib/time";
import { Avatar, Button, EmptyState, Skeleton } from "@/core/ui/components";
import { previewOf } from "@/features/messages/api";

type Pages = UseInfiniteQueryResult<InfiniteData<Page<Message>>>;

/** Danh sách tin (ghim / kết quả tìm): bấm để nhảy tới tin trong feed. Tải thêm bằng nút – không auto-scroll vô hạn. */
export function MessageResults({
  query,
  empty,
  onPick,
  showConversation,
}: {
  query: Pages;
  empty: string;
  onPick: (m: Message) => void;
  showConversation?: (m: Message) => string | null;
}) {
  const { t } = useTranslation();
  const nicknames = useSession((s) => s.bootstrap?.nicknames);
  if (query.isPending)
    return (
      <div className="flex flex-col gap-3 p-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  if (query.isError) return <EmptyState title={errorMessage(query.error)} />;
  const items = query.data.pages.flatMap((p) => p.items);
  if (!items.length) return <EmptyState title={empty} />;
  return (
    <div className="flex flex-col p-2" aria-busy={query.isFetching}>
      <ul className="flex flex-col">
        {items.map((m) => {
          const name = (m.sender && nicknames?.[m.sender._id]) || m.sender?.name || t("message.bot");
          const where = showConversation?.(m);
          return (
            <li key={m._id}>
              <button
                type="button"
                onClick={() => onPick(m)}
                className="flex w-full gap-3 rounded-md px-2 py-2 text-left hover:bg-muted coarse:py-3"
              >
                <Avatar src={m.sender?.profileImage} name={name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <time dateTime={m.createdAt} className="shrink-0 text-xs text-muted-foreground">
                      {formatShortTime(m.createdAt)}
                    </time>
                  </span>
                  {where && <span className="block truncate text-xs text-muted-foreground">{where}</span>}
                  <span className="line-clamp-2 text-sm text-muted-foreground">{previewOf(m)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {query.hasNextPage && (
        <Button
          variant="ghost"
          className="mt-1 self-center"
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t("common.loadMore")}
        </Button>
      )}
    </div>
  );
}
