import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCheck,
  Clock,
  Forward,
  MoreHorizontal,
  Pin,
  Reply,
  RotateCcw,
  SmilePlus,
  TriangleAlert,
  X,
} from "lucide-react";
import { memo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { qk } from "@/core/api/query";
import type { Conversation, ConversationMember, Message } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { cn } from "@/core/lib/cn";
import { formatClock, formatFull } from "@/core/lib/time";
import { ActionContextMenu, ActionDropdown, type ActionItem } from "@/core/ui/components/action-menu";
import { Avatar, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { memberName } from "@/features/conversations/display";
import { peopleApi } from "@/features/people/api";
import { PollCard } from "@/features/polls/PollCard";
import { retryMessage, toggleReaction } from "./api";
import { AttachmentGrid } from "./AttachmentGrid";
import { renderRichText } from "./linkify";
import { useOutbox, type OutboxItem } from "./outbox";
import { ReactionBar } from "./ReactionBar";
import { QUICK_REACTIONS } from "./reactions";
import { referencedUserIds, systemText } from "./system-text";
import { useMessageActions } from "./useMessageActions";

const EMPTY: Record<string, string> = {};

// ---------- tin thường ----------

export const MessageBubble = memo(function MessageBubble({
  message: m,
  conversation: conv,
  mine,
  groupStart,
  groupEnd,
  readers,
  highlighted,
}: {
  message: Message;
  conversation: Conversation;
  mine: boolean;
  groupStart: boolean;
  groupEnd: boolean;
  readers?: ConversationMember[];
  highlighted?: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const nicknames = useSession((s) => s.bootstrap?.nicknames ?? EMPTY);
  const { items, perms } = useMessageActions(m, conv);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  // Toolbar chỉ render cho tin đang được hover/focus (feed dài không phải mang hàng nghìn nút ẩn, ít điểm Tab).
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const isGroupish = conv.kind !== "direct";
  const senderName = nicknames[m.senderId] || m.sender?.name || memberName(conv, m.senderId, nicknames);
  const nameOf = (id: string) => (id === m.senderId ? senderName : memberName(conv, id, nicknames));
  const deleted = !!m.deletedAt;

  const touchItems: ActionItem[] = perms.canReact
    ? [
        ...QUICK_REACTIONS.map((emoji): ActionItem => ({
          key: `r-${emoji}`,
          label: t("message.reactWith", { emoji }),
          icon: <span className="text-base leading-none">{emoji}</span>,
          onSelect: () => void toggleReaction(qc, m, emoji).catch((e: unknown) => toast.error(e)),
        })),
        { type: "separator", key: "sep-r" },
        ...items,
      ]
    : items;

  return (
    <div
      className={cn(
        "group/msg relative flex gap-2 px-3 sm:px-4",
        mine ? "flex-row-reverse" : "flex-row",
        groupStart ? "mt-3" : "mt-0.5",
      )}
      data-highlighted={highlighted || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {!mine && (
        <div className="w-8 shrink-0 self-end">
          {groupEnd && <Avatar src={m.sender?.profileImage} name={senderName} size="sm" />}
        </div>
      )}
      <div className={cn("flex min-w-0 max-w-[min(78%,36rem)] flex-col", mine ? "items-end" : "items-start")}>
        {isGroupish && !mine && groupStart && (
          <span className="mb-0.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
            {senderName}
            {m.sender?.kind === "bot" && (
              <span className="rounded-sm bg-muted px-1 text-[10px] uppercase">{t("message.bot")}</span>
            )}
          </span>
        )}
        {m.forwardedFrom && !deleted && (
          <span className="mb-0.5 flex items-center gap-1 px-1 text-xs italic text-muted-foreground">
            <Forward className="size-3" aria-hidden="true" />
            {t("message.forwarded")}
          </span>
        )}
        <div className="relative max-w-full">
          <ActionContextMenu items={touchItems} disabled={!touchItems.length}>
            <div
              tabIndex={0}
              className={cn(
                "min-w-0 rounded-lg transition-shadow focus-visible:outline-offset-2",
                highlighted && "ring-2 ring-focus-ring ring-offset-2 ring-offset-background",
                bubbleShape(mine, groupStart, groupEnd),
                bodyTone(m, mine, deleted),
              )}
            >
              <MessageBody message={m} mine={mine} conversation={conv} />
            </div>
          </ActionContextMenu>
          {(hovered || focused || toolbarOpen) && (items.length > 0 || perms.canReact) && (
            <HoverToolbar
              mine={mine}
              message={m}
              items={items}
              canReact={perms.canReact}
              canReply={perms.canReply}
              open={toolbarOpen}
              onOpenChange={setToolbarOpen}
            />
          )}
        </div>
        {!deleted && <ReactionBar message={m} nameOf={nameOf} />}
        {groupEnd && (
          <MessageMeta message={m} mine={mine} isDirect={conv.kind === "direct"} readers={readers} nameOf={nameOf} />
        )}
      </div>
    </div>
  );
});

function bubbleShape(mine: boolean, start: boolean, end: boolean) {
  // Góc phía người gửi bo nhỏ ở giữa cụm để thấy các tin liền nhau thuộc một người.
  if (mine) return cn(!start && "rounded-tr-[6px]", !end && "rounded-br-[6px]");
  return cn(!start && "rounded-tl-[6px]", !end && "rounded-bl-[6px]");
}

function bodyTone(m: Message, mine: boolean, deleted: boolean) {
  if (deleted) return "border border-dashed border-border bg-transparent px-3 py-2 italic text-muted-foreground";
  if (m.type === "sticker") return "bg-transparent";
  // Thẻ bình chọn dùng nền trung tính cho cả hai phía: thanh kết quả/nút cần tương phản ổn định.
  if (m.type === "poll") return "w-80 max-w-full border border-border bg-surface px-3 py-3 text-foreground";
  return mine
    ? "bg-bubble-mine px-3 py-2 text-bubble-mine-foreground"
    : "border border-border bg-bubble-other px-3 py-2 text-bubble-other-foreground";
}

function MessageBody({
  message: m,
  mine,
  conversation: conv,
}: {
  message: Message;
  mine: boolean;
  conversation: Conversation;
}) {
  const { t } = useTranslation();
  const nicknames = useSession((s) => s.bootstrap?.nicknames ?? EMPTY);
  if (m.deletedAt) return <span>{t("message.deleted")}</span>;
  const linkClass = mine ? "underline underline-offset-2" : "text-primary-strong underline underline-offset-2";
  const mentionNames = m.mentions
    .map((id) => memberName(conv, id, {}))
    .concat(m.mentions.map((id) => nicknames[id] ?? ""));
  const text = m.text ? (
    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {renderRichText(m.text, mentionNames, linkClass)}
    </p>
  ) : null;

  switch (m.type) {
    case "sticker":
      return m.sticker?.url ? (
        <img
          src={m.sticker.url}
          alt={t("message.sticker", { name: m.sticker.emoji ?? "" })}
          className="size-28 object-contain"
          loading="lazy"
        />
      ) : (
        <span
          role="img"
          aria-label={t("message.sticker", { name: m.sticker?.emoji ?? "" })}
          className="block text-5xl leading-none"
        >
          {m.sticker?.emoji}
        </span>
      );
    case "command":
      return (
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              "self-start rounded-sm px-1.5 py-0.5 font-mono text-xs font-semibold",
              mine ? "bg-white/20" : "bg-primary-soft text-primary-strong",
            )}
          >
            /{m.command?.name}
          </span>
          {m.command?.args ? <p className="whitespace-pre-wrap break-words">{m.command.args}</p> : text}
        </div>
      );
    case "file":
      return (
        <div className="flex flex-col gap-1.5">
          <ReplyQuote message={m} mine={mine} />
          <AttachmentGrid attachments={m.attachments} mine={mine} />
          {text}
        </div>
      );
    case "poll":
      return <PollCard pollId={m.pollId} fallbackText={m.text} conversation={conv} />;
    default:
      return (
        <>
          <ReplyQuote message={m} mine={mine} />
          {text}
          {m.attachments.length > 0 && (
            <div className="mt-1.5">
              <AttachmentGrid attachments={m.attachments} mine={mine} />
            </div>
          )}
        </>
      );
  }
}

/** Khung trích dẫn tin được trả lời (replyPreview). */
function ReplyQuote({ message: m, mine }: { message: Message; mine: boolean }) {
  const { t } = useTranslation();
  const p = m.replyPreview;
  if (!m.replyTo || !p) return null;
  return (
    <div
      className={cn(
        "mb-1.5 rounded-sm border-l-2 px-2 py-1 text-sm",
        mine ? "border-white/60 bg-white/15" : "border-primary bg-muted",
      )}
    >
      <span className="block text-xs font-semibold">{p.senderName}</span>
      <span className="line-clamp-2 opacity-90">
        {p.deleted ? t("message.deleted") : p.text || (p.hasAttachments ? t("message.hasAttachment") : "")}
      </span>
    </div>
  );
}

function HoverToolbar({
  mine,
  message,
  items,
  canReact,
  canReply,
  open,
  onOpenChange,
}: {
  mine: boolean;
  message: Message;
  items: ActionItem[];
  canReact: boolean;
  canReply: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const reply = items.find((i) => i.key === "reply");
  const btn =
    "flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <div
      className={cn(
        // Nổi trên mép trên bong bóng (không chiếm chỗ trong luồng → không làm bong bóng hẹp lại)
        "absolute -top-4 z-10 flex items-center gap-0.5 rounded-md border border-border bg-surface-raised p-0.5 shadow-sm transition-opacity coarse:hidden",
        mine ? "left-0 -translate-x-2" : "right-0 translate-x-2",
        open && "ring-1 ring-border",
      )}
    >
      {canReact && (
        <Popover onOpenChange={onOpenChange}>
          <PopoverTrigger className={btn} aria-label={t("message.react")}>
            <SmilePlus className="size-4" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent className="flex gap-1 p-1.5" side="top">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={t("message.reactWith", { emoji })}
                className="flex size-9 items-center justify-center rounded-sm text-xl hover:bg-muted"
                onClick={() => void toggleReaction(qc, message, emoji).catch((e: unknown) => toast.error(e))}
              >
                {emoji}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
      {canReply && reply && reply.type !== "separator" && reply.type !== "label" && (
        <Tooltip content={t("message.reply")}>
          <button type="button" className={btn} aria-label={t("message.reply")} onClick={reply.onSelect}>
            <Reply className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>
      )}
      {items.length > 0 && (
        <ActionDropdown
          items={items}
          onOpenChange={onOpenChange}
          trigger={
            <button type="button" className={btn} aria-label={t("message.actions")}>
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          }
        />
      )}
    </div>
  );
}

function MessageMeta({
  message: m,
  mine,
  isDirect,
  readers,
  nameOf,
}: {
  message: Message;
  mine: boolean;
  isDirect: boolean;
  readers?: ConversationMember[];
  nameOf: (id: string) => string;
}) {
  const { t } = useTranslation();
  const others = readers ?? [];
  return (
    <div
      className={cn(
        "mt-0.5 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground",
        mine ? "flex-row-reverse" : "flex-row",
      )}
    >
      <time dateTime={m.createdAt} title={formatFull(m.createdAt)} className="tabular-nums">
        {formatClock(m.createdAt)}
      </time>
      {m.editedAt && !m.deletedAt && <span>· {t("message.edited")}</span>}
      {m.pinnedAt && <Pin className="size-3" aria-label={t("message.pinned")} role="img" />}
      {mine && isDirect && (
        <span className="flex items-center gap-0.5">
          {others.length > 0 ? (
            <>
              <CheckCheck className="size-3.5 text-primary-strong" aria-hidden="true" />
              {t("chat.readBy")}
            </>
          ) : (
            <Check className="size-3.5" aria-label={t("message.sent")} role="img" />
          )}
        </span>
      )}
      {!isDirect && others.length > 0 && (
        <span
          className="flex items-center -space-x-1"
          role="img"
          aria-label={t("chat.readByNames", { names: others.map((r) => nameOf(r.user._id)).join(", ") })}
        >
          {others.slice(0, 5).map((r) => (
            <Avatar
              key={r.user._id}
              src={r.user.profileImage}
              name={nameOf(r.user._id)}
              size="xs"
              className="ring-1 ring-background rounded-full"
            />
          ))}
          {others.length > 5 && <span className="pl-1.5">+{others.length - 5}</span>}
        </span>
      )}
    </div>
  );
}

// ---------- tin hệ thống ----------

export const SystemMessage = memo(function SystemMessage({
  message,
  conversation,
}: {
  message: Message;
  conversation: Conversation;
}) {
  const nicknames = useSession((s) => s.bootstrap?.nicknames ?? EMPTY);
  const registered = useSession((s) => s.bootstrap?.me.kind === "user");
  // người được nhắc tới nhưng đã rời hội thoại → tải tên (GET /api/users/:id chỉ cho tài khoản đăng ký)
  const missing = registered
    ? referencedUserIds(message).filter((id) => !nicknames[id] && !conversation.members.some((m) => m.user._id === id))
    : [];
  const users = useQueries({
    queries: missing.map((id) => ({
      queryKey: qk.user(id),
      queryFn: () => peopleApi.get(id),
      staleTime: 5 * 60_000,
      retry: false,
    })),
  });
  const known: Record<string, string> = {};
  users.forEach((q, i) => {
    const id = missing[i];
    if (id && q.data) known[id] = q.data.name;
  });
  return (
    <div className="my-2 flex justify-center px-4">
      <p className="max-w-[90%] rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
        {systemText(message, conversation, nicknames, known)}
      </p>
    </div>
  );
});

// ---------- tin đang gửi / lỗi (outbox) ----------

export const PendingBubble = memo(function PendingBubble({ item }: { item: OutboxItem }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const failed = item.status === "failed";
  const remove = useOutbox((s) => s.remove);
  let body: ReactNode = <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.body.text}</p>;
  if (item.body.type === "sticker") body = <span className="text-5xl leading-none">…</span>;
  return (
    <div className="mt-0.5 flex flex-row-reverse gap-2 px-3 sm:px-4">
      <div className="flex max-w-[min(78%,36rem)] flex-col items-end">
        <div
          className={cn(
            "rounded-lg bg-bubble-mine px-3 py-2 text-bubble-mine-foreground",
            failed ? "opacity-80 ring-2 ring-danger" : "opacity-70",
          )}
        >
          {item.replyPreview && (
            <div className="mb-1.5 rounded-sm border-l-2 border-white/60 bg-white/15 px-2 py-1 text-sm">
              <span className="block text-xs font-semibold">{item.replyPreview.senderName}</span>
              <span className="line-clamp-2">{item.replyPreview.text}</span>
            </div>
          )}
          {body}
          {item.body.attachments?.length ? (
            <span className="mt-1 block text-xs">{t("message.hasAttachment")}</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2 px-1 text-[11px]" role={failed ? "alert" : "status"}>
          {failed ? (
            <>
              <span className="flex items-center gap-1 text-danger">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                {item.error ? errorMessage(item.error) : t("message.failed")}
              </span>
              <button
                type="button"
                className="flex items-center gap-1 font-medium text-primary-strong hover:underline"
                onClick={() => retryMessage(qc, item.conversationId, item.clientMsgId)}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {t("message.retry")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 text-muted-foreground hover:underline"
                onClick={() => remove(item.conversationId, item.clientMsgId)}
              >
                <X className="size-3.5" aria-hidden="true" />
                {t("message.discard")}
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" aria-hidden="true" />
              {t("message.sending")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
