import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Pencil, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { Conversation, Message } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { formatRelative } from "@/core/lib/time";
import {
  Avatar,
  Button,
  ConfirmDialog,
  IconButton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/core/ui/components";
import { useShellPath } from "@/core/ui/shell";
import { toast } from "@/core/ui/toast";
import { leaveGroup } from "@/features/groups/api";
import { usePresence } from "@/features/people/presence";
import { useProfileSheet } from "@/features/people/profile-store";
import { usePins } from "@/features/search/api";
import { conversationAvatar, membersLabel, peerOf, useConversationTitle } from "../display";
import { useJumpTo } from "../useJumpTo";
import { EditGroupDialog } from "./EditGroupDialog";
import { MediaTab } from "./MediaTab";
import { MembersTab } from "./MembersTab";
import { MessageResults } from "./MessageResults";
import { SearchTab } from "./SearchTab";

type Tab = "members" | "pinned" | "media" | "search";

/**
 * Thông tin hội thoại (màn 09/10): hồ sơ ngắn, thành viên & vai trò, tin ghim, thư viện media, tìm trong hội thoại, rời nhóm.
 * `inline` = cột phải ở pane ≥1200px; còn lại hiển thị trong Sheet (ChatView quyết định).
 */
export function DetailsPanel({
  conversation: c,
  inline,
  onClose,
}: {
  conversation: Conversation;
  inline: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const to = useShellPath();
  const jumpTo = useJumpTo();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const title = useConversationTitle(c);
  const peer = peerOf(c, meId);
  const presence = usePresence(peer?._id);
  const openProfile = useProfileSheet((s) => s.open);
  const isGroup = c.kind === "group";
  const manager = isGroup && (c.myRole === "owner" || c.myRole === "admin");
  const [tab, setTab] = useState<Tab>(isGroup ? "members" : "pinned");
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pins = usePins(c._id, tab === "pinned");

  // Ở Sheet, nhảy tới tin thì đóng panel để thấy feed; ở cột phải giữ panel.
  const onJump = (m: Message) => jumpTo(m, { closePanel: !inline });

  const subtitle = peer
    ? presence?.online
      ? t("chat.online")
      : presence?.lastSeenAt
        ? t("chat.lastSeen", { time: formatRelative(presence.lastSeenAt) })
        : t("chat.offline")
    : membersLabel(c);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {inline && (
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <h2 className="text-base font-semibold">{t("details.title")}</h2>
          <IconButton label={t("details.close")} icon={<X />} size="sm" onClick={onClose} />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <section className="flex flex-col items-center gap-2 px-4 pb-4 pt-5 text-center">
          <Avatar
            src={conversationAvatar(c, meId)}
            name={title}
            size="xl"
            online={peer ? (presence?.online ?? false) : undefined}
          />
          <div className="min-w-0 max-w-full">
            <p className="truncate text-lg font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {manager && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                {t("details.edit")}
              </Button>
            )}
            {peer && peer.kind === "user" && (
              <Button variant="secondary" size="sm" onClick={() => openProfile(peer._id)}>
                <UserRound aria-hidden="true" />
                {t("details.profile")}
              </Button>
            )}
          </div>
          {c.myRole === null && <p className="text-xs text-muted-foreground">{t("details.readonly")}</p>}
        </section>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="sticky top-0 z-10 gap-0 bg-surface px-1 [&>button]:grow [&>button]:justify-center [&>button]:whitespace-nowrap [&>button]:px-1.5">
            {isGroup && (
              <TabsTrigger value="members" count={c.memberCount}>
                {t("details.tabs.members")}
              </TabsTrigger>
            )}
            <TabsTrigger value="pinned">{t("details.tabs.pinned")}</TabsTrigger>
            <TabsTrigger value="media">{t("details.tabs.media")}</TabsTrigger>
            <TabsTrigger value="search">{t("details.tabs.search")}</TabsTrigger>
          </TabsList>
          {isGroup && (
            <TabsContent value="members">
              <MembersTab conversation={c} />
            </TabsContent>
          )}
          <TabsContent value="pinned">
            <MessageResults query={pins} empty={t("details.noPinned")} onPick={onJump} />
          </TabsContent>
          <TabsContent value="media">
            <MediaTab conversation={c} onJump={onJump} />
          </TabsContent>
          <TabsContent value="search">
            <SearchTab conversation={c} onJump={onJump} />
          </TabsContent>
        </Tabs>
      </div>

      {isGroup && c.myRole !== null && (
        <div className="shrink-0 border-t border-border p-3 safe-bottom">
          <Button variant="danger-ghost" block className="justify-start" onClick={() => setLeaving(true)}>
            <LogOut aria-hidden="true" />
            {t("details.leave")}
          </Button>
        </div>
      )}

      {editing && <EditGroupDialog conversation={c} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t("details.leaveConfirm")}
        description={t("details.leaveBody")}
        confirmLabel={t("details.leave")}
        onConfirm={async () => {
          try {
            await leaveGroup(qc, c._id);
            toast.success(t("details.left"));
            navigate(to(""), { replace: true });
          } catch (error) {
            // CHAT-409-002: trưởng nhóm duy nhất phải chuyển quyền trước – thông điệp đã nói rõ.
            toast.error(error);
            if (c.myRole === "owner") setTab("members");
          }
        }}
      />
    </div>
  );
}
