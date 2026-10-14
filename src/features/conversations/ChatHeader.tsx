import { ArrowLeft, MoreVertical } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { Conversation } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { formatRelative } from "@/core/lib/time";
import { Avatar, IconButton } from "@/core/ui/components";
import { ActionDropdown } from "@/core/ui/components/action-menu";
import { useShell, useShellPath } from "@/core/ui/shell";
import { usePresence } from "@/features/people/presence";
import { useConversationActions } from "./useConversationActions";
import { conversationAvatar, membersLabel, peerOf, useConversationTitle } from "./display";

/** Header chat: back (màn hẹp), ảnh + tên (biệt danh), trạng thái online / số thành viên, menu tuỳ chọn riêng. */
export function ChatHeader({ conversation: c, actions }: { conversation: Conversation; actions?: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { size } = useShell();
  const to = useShellPath();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const title = useConversationTitle(c);
  const peer = peerOf(c, meId);
  const presence = usePresence(peer?._id);
  const menu = useConversationActions(c);
  const narrow = size === "small" || size === "medium";

  const subtitle = peer
    ? presence?.online
      ? t("chat.online")
      : presence?.lastSeenAt
        ? t("chat.lastSeen", { time: formatRelative(presence.lastSeenAt) })
        : t("chat.offline")
    : membersLabel(c);

  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 safe-top">
      {narrow && <IconButton label={t("chat.back")} icon={<ArrowLeft />} onClick={() => navigate(to(""))} />}
      <div className="flex min-w-0 flex-1 items-center gap-3 pl-1">
        <Avatar
          src={conversationAvatar(c, meId)}
          name={title}
          size="md"
          online={peer ? (presence?.online ?? false) : undefined}
        />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        {c.myRole !== null && (
          <ActionDropdown
            items={menu}
            trigger={<IconButton label={t("inbox.actions", { name: title })} icon={<MoreVertical />} />}
          />
        )}
      </div>
    </header>
  );
}
