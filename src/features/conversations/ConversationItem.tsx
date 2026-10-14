import { BellOff, MoreHorizontal, Pin } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Conversation } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { cn } from "@/core/lib/cn";
import { formatShortTime } from "@/core/lib/time";
import { ActionContextMenu, ActionDropdown } from "@/core/ui/components/action-menu";
import { Avatar, CountBadge } from "@/core/ui/components";
import { usePresence } from "@/features/people/presence";
import { conversationAvatar, conversationTitle, peerOf, previewText } from "./display";
import { useConversationActions } from "./useConversationActions";

const EMPTY: Record<string, string> = {};

export const ConversationItem = memo(function ConversationItem({
  conversation: c,
  href,
  active,
}: {
  conversation: Conversation;
  href: string;
  active: boolean;
}) {
  const { t } = useTranslation();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const nicknames = useSession((s) => s.bootstrap?.nicknames ?? EMPTY);
  const peer = peerOf(c, meId);
  const presence = usePresence(peer?._id);
  const title = conversationTitle(c, meId, nicknames);
  const actions = useConversationActions(c);
  const unread = c.unreadCount > 0;
  const time = c.lastMessage?.at ?? c.updatedAt;

  return (
    <ActionContextMenu items={actions}>
      <div
        className={cn(
          "group relative flex items-center rounded-md transition-colors duration-(--duration-fast)",
          active ? "bg-primary-soft" : "hover:bg-muted",
        )}
      >
        <Link
          to={href}
          aria-current={active ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2.5 focus-visible:outline-offset-[-2px]"
        >
          <Avatar
            src={conversationAvatar(c, meId)}
            name={title}
            size="lg"
            online={peer ? (presence?.online ?? false) : undefined}
            onlineLabel={peer ? (presence?.online ? t("chat.online") : t("chat.offline")) : undefined}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{title}</span>
              <time
                dateTime={time}
                className={cn(
                  "ml-auto shrink-0 text-xs tabular-nums",
                  unread ? "font-semibold text-primary-strong" : "text-muted-foreground",
                )}
              >
                {formatShortTime(time)}
              </time>
            </span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <span className={cn("truncate text-sm", unread ? "text-foreground" : "text-muted-foreground")}>
                {previewText(c.lastMessage, c, meId, nicknames)}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
                {c.muted && <BellOff className="size-3.5" aria-label={t("inbox.muted")} role="img" />}
                {c.pinned && <Pin className="size-3.5" aria-label={t("inbox.pinned")} role="img" />}
                <CountBadge
                  count={c.unreadCount}
                  label={t("inbox.unread", { count: c.unreadCount })}
                  className={c.muted ? "bg-muted-foreground text-surface" : undefined}
                />
              </span>
            </span>
          </span>
        </Link>
        <ActionDropdown
          items={actions}
          trigger={
            <button
              type="button"
              aria-label={t("inbox.actions", { name: title })}
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-surface text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 coarse:hidden"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          }
        />
      </div>
    </ActionContextMenu>
  );
});
