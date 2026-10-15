import { Inbox, Tag, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import type { Conversation, Id } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { cn } from "@/core/lib/cn";
import { formatShortTime } from "@/core/lib/time";
import { Avatar, Badge, Button, EmptyState, Input, Skeleton } from "@/core/ui/components";
import { useSupportQueue, useSupportStats } from "@/features/support/api";
import { QUEUE_TABS, type QueueFilter, type QueueTab } from "@/features/support/queue";
import { StatusBadge } from "./StatusBadge";

/** Hàng đợi (màn 17): tab theo trạng thái (số lượng từ /stats), lọc tag, tải thêm theo cursor. */
export function QueuePane({
  filter,
  onFilter,
  activeId,
}: {
  filter: QueueFilter;
  onFilter: (f: QueueFilter) => void;
  activeId: Id | null;
}) {
  const { t } = useTranslation();
  const stats = useSupportStats();
  const query = useSupportQueue(filter);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const [tagDraft, setTagDraft] = useState("");
  const counts: Partial<Record<QueueTab, number>> = stats.data
    ? { waiting: stats.data.waiting_agent, mine: stats.data.mineOpen, agent: stats.data.agent }
    : {};

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="group"
        aria-label={t("agent.queue")}
        className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 scrollbar-thin"
      >
        {QUEUE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={filter.tab === tab}
            onClick={() => onFilter({ ...filter, tab })}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors coarse:h-11",
              filter.tab === tab
                ? "border-transparent bg-primary-soft text-primary-strong"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(`agent.tabs.${tab}`)}
            {counts[tab] ? <span className="tabular-nums">{counts[tab]}</span> : null}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {filter.tag ? (
          <Badge tone="primary" className="gap-1 pr-1">
            <Tag className="size-3" aria-hidden="true" />
            {filter.tag}
            <button
              type="button"
              aria-label={t("agent.clearTag", { tag: filter.tag })}
              onClick={() => onFilter({ ...filter, tag: "" })}
              className="flex size-5 items-center justify-center rounded-full hover:bg-white/40"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        ) : (
          <form
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              const tag = tagDraft.trim().toLowerCase();
              if (tag) onFilter({ ...filter, tag });
              setTagDraft("");
            }}
          >
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder={t("agent.tagFilter")}
              aria-label={t("agent.tagFilter")}
              className="h-8 coarse:h-11"
              maxLength={32}
            />
          </form>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin" aria-busy={query.isFetching}>
        {query.isPending ? (
          <div className="flex flex-col gap-3 p-3" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
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
          <EmptyState icon={<Inbox />} title={t(`agent.empty.${filter.tab}`)} />
        ) : (
          <ul className="flex flex-col p-1.5">
            {items.map((c) => (
              <QueueRow
                key={c._id}
                conversation={c}
                active={c._id === activeId}
                onTag={(tag) => onFilter({ ...filter, tag })}
              />
            ))}
          </ul>
        )}
        {query.hasNextPage && (
          <div className="flex justify-center p-2">
            <Button variant="ghost" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              {t("common.loadMore")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueRow({
  conversation: c,
  active,
  onTag,
}: {
  conversation: Conversation;
  active: boolean;
  onTag: (tag: string) => void;
}) {
  const { t } = useTranslation();
  const { search } = useLocation();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const support = c.support;
  if (!support) return null;
  const customer = support.customer;
  const name = customer?.name || c.title;
  const assignee =
    support.assigneeId === meId ? `${support.assignee?.name ?? ""} ${t("agent.you")}`.trim() : support.assignee?.name;
  return (
    <li className={cn("rounded-md", active ? "bg-primary-soft" : "hover:bg-muted")}>
      <Link
        to={`/support/t/${c._id}${search}`}
        aria-current={active ? "page" : undefined}
        className="flex gap-3 rounded-md px-2.5 py-2.5"
      >
        <Avatar src={customer?.profileImage} name={name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">{name}</span>
            <time dateTime={c.updatedAt} className="ml-auto shrink-0 text-xs text-muted-foreground">
              {formatShortTime(c.updatedAt)}
            </time>
          </span>
          <span className="block truncate text-sm text-muted-foreground">{c.lastMessage?.preview ?? ""}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <StatusBadge status={support.status} />
            {customer?.kind === "visitor" && <Badge>{t("agent.visitor")}</Badge>}
            {assignee && <span className="truncate text-xs text-muted-foreground">{assignee}</span>}
          </span>
        </span>
      </Link>
      {support.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 pb-2 pl-[3.75rem]">
          {support.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTag(tag)}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
