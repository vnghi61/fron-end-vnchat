import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageSquarePlus, MessagesSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import type { Conversation } from "@/core/api/types";
import { useFeatures } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { cn } from "@/core/lib/cn";
import { Button, EmptyState, IconButton, Skeleton, Spinner } from "@/core/ui/components";
import { useShell, useShellPath } from "@/core/ui/shell";
import { AccountMenu } from "@/features/account/AccountMenu";
import { ensurePresence } from "@/features/people/presence";
import { useInbox } from "./api";
import type { InboxFilter } from "./cache";
import { ConversationItem } from "./ConversationItem";
import { NewChatDialog } from "./NewChatDialog";

type Row =
  | { kind: "header"; key: string; label: string }
  | { kind: "conversation"; key: string; conversation: Conversation }
  | { kind: "loader"; key: string };

const FILTERS: {
  value: InboxFilter;
  labelKey:
    "inbox.filterAll" | "inbox.filterDirect" | "inbox.filterGroup" | "inbox.filterSupport" | "inbox.filterArchived";
}[] = [
  { value: "inbox", labelKey: "inbox.filterAll" },
  { value: "kind:direct", labelKey: "inbox.filterDirect" },
  { value: "kind:group", labelKey: "inbox.filterGroup" },
  { value: "kind:support", labelKey: "inbox.filterSupport" },
  { value: "archived", labelKey: "inbox.filterArchived" },
];

/** Danh sách hội thoại (ảo hoá). Mục "Đã ghim" (GET ?pinned=true) đứng đầu ở bộ lọc Tất cả, không lặp ở "Gần đây". */
export function InboxPane() {
  const { t } = useTranslation();
  const { size } = useShell();
  const to = useShellPath();
  const features = useFeatures();
  const { conversationId } = useParams();
  const [filter, setFilter] = useState<InboxFilter>("inbox");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const list = useInbox(filter);
  const pinned = useInbox("pinned", filter === "inbox");
  const scrollRef = useRef<HTMLDivElement>(null);
  const narrow = size === "small" || size === "medium";

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const pinnedItems = filter === "inbox" ? (pinned.data?.pages.flatMap((p) => p.items) ?? []) : [];
    const pinnedIds = new Set(pinnedItems.map((c) => c._id));
    const items = (list.data?.pages.flatMap((p) => p.items) ?? []).filter((c) => !pinnedIds.has(c._id));
    if (pinnedItems.length) {
      out.push({ kind: "header", key: "h-pinned", label: t("inbox.pinnedSection") });
      pinnedItems.forEach((c) => out.push({ kind: "conversation", key: `p-${c._id}`, conversation: c }));
      if (items.length) out.push({ kind: "header", key: "h-all", label: t("inbox.allSection") });
    }
    items.forEach((c) => out.push({ kind: "conversation", key: c._id, conversation: c }));
    if (list.hasNextPage) out.push({ kind: "loader", key: "loader" });
    return out;
  }, [filter, pinned.data, list.data, list.hasNextPage, t]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === "header" ? 32 : 68),
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 6,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const firstIndex = virtualItems[0]?.index ?? -1;
  const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;

  // Hàng "loader" lọt vào vùng nhìn → tải trang tiếp; hỏi trạng thái online của những người đang hiển thị.
  useEffect(() => {
    if (lastIndex < 0) return;
    if (rows[lastIndex]?.kind === "loader" && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    const peers: string[] = [];
    for (let i = Math.max(0, firstIndex); i <= lastIndex; i++) {
      const r = rows[i];
      if (r?.kind === "conversation" && r.conversation.kind === "direct" && r.conversation.peer)
        peers.push(r.conversation.peer._id);
    }
    ensurePresence(peers);
  }, [firstIndex, lastIndex, rows, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const visibleFilters = FILTERS.filter((f) => f.value !== "kind:support" || features.support);

  return (
    <section aria-label={t("inbox.title")} className="flex h-full flex-col bg-surface">
      <header className="flex min-h-14 shrink-0 items-center gap-2 px-3 safe-top">
        <h1 className="flex-1 truncate text-lg font-semibold">{t("inbox.title")}</h1>
        <IconButton label={t("inbox.newChat")} icon={<MessageSquarePlus />} onClick={() => setNewChatOpen(true)} />
        {narrow && <AccountMenu side="bottom" />}
      </header>

      <div
        role="group"
        aria-label={t("inbox.filters")}
        className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-thin"
      >
        {visibleFilters.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors coarse:h-10",
              filter === f.value
                ? "border-primary bg-primary-soft text-primary-strong"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
        {list.isPending ? (
          <InboxSkeleton />
        ) : list.isError ? (
          <EmptyState
            title={errorMessage(list.error)}
            action={
              <Button variant="secondary" onClick={() => void list.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare />}
            title={filter === "archived" ? t("inbox.emptyArchived") : t("inbox.empty")}
            description={filter === "archived" ? undefined : t("inbox.emptyHint")}
            action={
              filter === "archived" ? undefined : (
                <Button onClick={() => setNewChatOpen(true)}>
                  <MessageSquarePlus aria-hidden="true" />
                  {t("inbox.newChat")}
                </Button>
              )
            }
          />
        ) : (
          <ul role="list" className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualItems.map((v) => {
              const row = rows[v.index]!;
              return (
                <li
                  key={v.key}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${v.start}px)` }}
                >
                  {row.kind === "header" ? (
                    <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.label}
                    </p>
                  ) : row.kind === "loader" ? (
                    <div className="flex justify-center py-3 text-muted-foreground">
                      <Spinner label={t("common.loading")} />
                    </div>
                  ) : (
                    <ConversationItem
                      conversation={row.conversation}
                      href={to(`/c/${row.conversation._id}`)}
                      active={row.conversation._id === conversationId}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />
    </section>
  );
}

function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-1" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
