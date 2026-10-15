import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type { Conversation } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { cn } from "@/core/lib/cn";
import { formatDayLabel } from "@/core/lib/time";
import { Button, EmptyState, Skeleton, Spinner } from "@/core/ui/components";
import { useDocumentVisible } from "@/core/ui/hooks";
import { toast } from "@/core/ui/toast";
import { markConversationRead } from "@/features/conversations/api";
import { useConversationTitle } from "@/features/conversations/display";
import { useChatUi } from "@/features/conversations/ui-store";
import { useMessages } from "./api";
import { flattenMessages } from "./cache";
import { MessageBubble, PendingBubble, SystemMessage } from "./MessageBubble";
import { useConversationOutbox } from "./outbox";
import { buildRows, readersByMessage, type FeedRow } from "./rows";

// Feed tin ảo hoá (TanStack Virtual) với neo cuối: anchorTo "end" giữ nguyên vị trí khi chèn tin cũ lên đầu,
// followOnAppend tự cuộn khi có tin mới và người dùng đang ở cuối. Không animation khi thêm tin (spec §3.3).

const estimate = (row: FeedRow | undefined) => {
  switch (row?.kind) {
    case "start":
    case "day":
    case "unread":
      return 40;
    case "system":
      return 36;
    case "message":
      return row.message.attachments.length ? 260 : row.groupStart ? 64 : 44;
    default:
      return 56;
  }
};

const AT_END_PX = 96;
const JUMP_MAX_PAGES = 12; // ≈ 600 tin – không có API "tin quanh seq" (contract map B6)

export function MessageFeed({ conversation }: { conversation: Conversation }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const title = useConversationTitle(conversation);
  const query = useMessages(conversation._id);
  const outbox = useConversationOutbox(conversation._id);
  const setAtBottom = useChatUi((s) => s.setAtBottom);
  const visible = useDocumentVisible();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [params, setParams] = useSearchParams();
  const jumpId = params.get("msg");
  const jumpSeq = Number(params.get("seq")) || null;
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // seq đã đọc lúc mở – vạch "Tin nhắn mới" giữ cố định trong lần xem này
  const [unreadAfterSeq] = useState<number | null>(() => {
    const me = conversation.members.find((m) => m.user._id === meId);
    return conversation.unreadCount > 0 && me ? me.lastReadSeq : null;
  });

  const messages = useMemo(() => flattenMessages(query.data), [query.data]);
  const reachedStart = query.isSuccess && !query.hasNextPage;
  const rows = useMemo<FeedRow[]>(() => {
    const built = buildRows(messages, outbox, meId, unreadAfterSeq);
    return reachedStart ? [{ kind: "start", key: "start" }, ...built] : built;
  }, [messages, outbox, meId, unreadAfterSeq, reachedStart]);
  const readers = useMemo(
    () => readersByMessage(messages, conversation.members, meId),
    [messages, conversation.members, meId],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => estimate(rows[i]),
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 10,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: AT_END_PX,
    paddingStart: 12,
    paddingEnd: 12,
  });

  // Dính cuối chắc chắn: chiều cao thật của tin chỉ biết sau khi đo (ảnh, xuống dòng) → cuộn lại vài khung hình cho tới
  // khi ổn định; dừng ngay nếu người dùng tự cuộn (wheel/touch/phím).
  const userScrolled = useRef(false);
  const atEndRef = useRef(true);
  const settleToEnd = useCallback(() => {
    userScrolled.current = false;
    let frames = 0;
    let stable = 0;
    const tick = () => {
      const el = scrollRef.current;
      if (!el || userScrolled.current) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 1) {
        virtualizer.scrollToEnd();
        stable = 0;
      } else stable++;
      if (++frames < 40 && stable < 4) requestAnimationFrame(tick);
    };
    virtualizer.scrollToEnd();
    requestAnimationFrame(tick);
  }, [virtualizer]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mark = () => {
      userScrolled.current = true;
    };
    el.addEventListener("wheel", mark, { passive: true });
    el.addEventListener("touchstart", mark, { passive: true });
    el.addEventListener("keydown", mark);
    // Khung đổi kích thước (xoay máy, bàn phím ảo, iframe co giãn): đang ở cuối thì giữ ở cuối.
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => atEndRef.current && settleToEnd());
    ro?.observe(el);
    return () => {
      el.removeEventListener("wheel", mark);
      el.removeEventListener("touchstart", mark);
      el.removeEventListener("keydown", mark);
      ro?.disconnect();
    };
  }, [settleToEnd, query.isSuccess]);

  // Lần đầu có dữ liệu: xuống tin mới nhất (trừ khi đang mở để nhảy tới một tin cụ thể).
  const initialScrolled = useRef(false);
  useLayoutEffect(() => {
    if (initialScrolled.current || !rows.length) return;
    initialScrolled.current = true;
    if (!jumpId) settleToEnd();
  }, [rows.length, settleToEnd, jumpId]);

  // Nhảy tới tin (?msg=&seq=): tải lùi từng trang tới khi có, cuộn vào giữa và tô viền 2.5s.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (!jumpId || !query.isSuccess || isFetchingNextPage) return;
    const clear = () =>
      setParams(
        (p) => {
          p.delete("msg");
          p.delete("seq");
          return p;
        },
        { replace: true },
      );
    const index = rows.findIndex((r) => r.kind === "message" && r.message._id === jumpId);
    if (index !== -1) {
      userScrolled.current = true; // không để "dính cuối" kéo đi mất
      virtualizer.scrollToIndex(index, { align: "center" });
      setHighlightId(jumpId);
      clear();
      const id = setTimeout(() => setHighlightId(null), 2500);
      return () => clearTimeout(id);
    }
    const oldest = messages[0]?.seq ?? 0;
    const pages = query.data?.pages.length ?? 0;
    if (hasNextPage && pages < JUMP_MAX_PAGES && (jumpSeq === null || oldest > jumpSeq)) {
      void fetchNextPage();
      return;
    }
    toast.info(t("details.jumpFailed"));
    clear();
  }, [
    jumpId,
    jumpSeq,
    rows,
    messages,
    query.isSuccess,
    query.data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    virtualizer,
    setParams,
    t,
  ]);

  // Tin của chính mình (outbox mới) → luôn xuống cuối dù đang đọc tin cũ.
  const outboxCount = outbox.length;
  const prevOutbox = useRef(outboxCount);
  useEffect(() => {
    if (outboxCount > prevOutbox.current) settleToEnd();
    prevOutbox.current = outboxCount;
  }, [outboxCount, settleToEnd]);

  // Đếm tin mới chưa thấy khi đang không ở cuối
  const lastSeq = messages[messages.length - 1]?.seq ?? 0;
  const prevLastSeq = useRef(lastSeq);
  useEffect(() => {
    if (lastSeq > prevLastSeq.current && !atEnd) {
      const added = messages.filter((m) => m.seq > prevLastSeq.current && m.senderId !== meId).length;
      if (added) setUnseen((n) => n + added);
    }
    prevLastSeq.current = lastSeq;
  }, [lastSeq, atEnd, messages, meId]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const end = el.scrollHeight - el.scrollTop - el.clientHeight <= AT_END_PX;
    atEndRef.current = end;
    setAtEnd(end);
    setAtBottom(end);
    if (end) setUnseen(0);
    if (el.scrollTop < 400 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, setAtBottom]);

  // Trang đầu quá ngắn không cuộn được → tải tiếp cho tới khi có thanh cuộn
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Đánh dấu đã đọc khi đang nhìn thấy cuối feed
  useEffect(() => {
    // myRole null = nhân viên đang xem yêu cầu chưa nhận (không phải thành viên → không có trạng thái đã đọc)
    if (!meId || !atEnd || !visible || !query.isSuccess || conversation.myRole === null) return;
    const id = setTimeout(() => void markConversationRead(qc, conversation, meId), 300);
    return () => clearTimeout(id);
  }, [qc, conversation, meId, atEnd, visible, query.isSuccess, lastSeq]);

  if (query.isPending) return <FeedSkeleton />;
  if (query.isError)
    return (
      <EmptyState
        className="flex-1"
        title={errorMessage(query.error)}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );

  const items = virtualizer.getVirtualItems();
  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="off"
        aria-label={t("chat.feedLabel", { name: title })}
        className="h-full overflow-y-auto overscroll-contain scrollbar-thin [overflow-anchor:none]"
      >
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {isFetchingNextPage && (
            <div className="absolute inset-x-0 top-2 z-10 flex justify-center">
              <span className="flex items-center gap-2 rounded-full bg-surface-raised px-3 py-1 text-xs text-muted-foreground shadow-sm">
                <Spinner className="size-3.5" />
                {t("chat.loadingOlder")}
              </span>
            </div>
          )}
          {items.map((v) => {
            const row = rows[v.index]!;
            return (
              <div
                key={v.key}
                data-index={v.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${v.start}px)` }}
              >
                <FeedRowView
                  row={row}
                  conversation={conversation}
                  readers={row.kind === "message" ? readers.get(row.message._id) : undefined}
                  highlighted={row.kind === "message" && row.message._id === highlightId}
                />
              </div>
            );
          })}
        </div>
      </div>
      {!atEnd && (
        <button
          type="button"
          onClick={() => {
            settleToEnd();
            setUnseen(0);
          }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium shadow-md hover:bg-muted coarse:py-2.5"
        >
          <ArrowDown className="size-4" aria-hidden="true" />
          {unseen > 0 ? t("chat.newMessages", { count: unseen }) : t("chat.jumpToLatest")}
        </button>
      )}
    </div>
  );
}

function FeedRowView({
  row,
  conversation,
  readers,
  highlighted,
}: {
  row: FeedRow;
  conversation: Conversation;
  readers?: Parameters<typeof MessageBubble>[0]["readers"];
  highlighted?: boolean;
}) {
  const { t } = useTranslation();
  switch (row.kind) {
    case "start":
      return <FeedStart conversation={conversation} />;
    case "day":
      return (
        <div className="flex justify-center py-2">
          <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
            {formatDayLabel(row.at)}
          </span>
        </div>
      );
    case "unread":
      return (
        <div className="flex items-center gap-3 px-4 py-2" role="separator" aria-label={t("chat.unreadDivider")}>
          <span className="h-px flex-1 bg-danger/50" />
          <span className="text-xs font-semibold text-danger">{t("chat.unreadDivider")}</span>
          <span className="h-px flex-1 bg-danger/50" />
        </div>
      );
    case "system":
      return <SystemMessage message={row.message} conversation={conversation} />;
    case "pending":
      return <PendingBubble item={row.item} />;
    case "message":
      return (
        <MessageBubble
          message={row.message}
          conversation={conversation}
          mine={row.mine}
          groupStart={row.groupStart}
          groupEnd={row.groupEnd}
          readers={readers}
          highlighted={highlighted}
        />
      );
  }
}

function FeedStart({ conversation }: { conversation: Conversation }) {
  const { t } = useTranslation();
  const hidden = conversation.historyFromSeq > 1;
  return (
    <p className="px-4 py-3 text-center text-xs text-muted-foreground">
      {hidden ? t("chat.historyHidden") : t("chat.beginning")}
    </p>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-3 p-4" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={cn("flex items-end gap-2", i % 2 ? "flex-row-reverse" : "")}>
          {i % 2 === 0 && <Skeleton className="size-8 rounded-full" />}
          <Skeleton className={cn("h-10 rounded-lg", i % 3 === 0 ? "w-56" : "w-36")} />
        </div>
      ))}
    </div>
  );
}
