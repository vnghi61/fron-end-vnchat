import { useQueryClient } from "@tanstack/react-query";
import { MessageSquareOff } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { isApiError } from "@/core/api/errors";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { Button, ConfirmDialog, EmptyState, Spinner } from "@/core/ui/components";
import { useShellPath } from "@/core/ui/shell";
import { toast } from "@/core/ui/toast";
import { deleteMessage } from "@/features/messages/api";
import { Composer } from "@/features/messages/Composer";
import { useMessageDialogs } from "@/features/messages/dialog-store";
import { ForwardDialog } from "@/features/messages/ForwardDialog";
import { MessageFeed } from "@/features/messages/MessageFeed";
import { TypingIndicator } from "@/features/messages/TypingIndicator";
import { ensurePresence } from "@/features/people/presence";
import { useConversation } from "./api";
import { ChatHeader } from "./ChatHeader";
import { peerOf } from "./display";
import { useChatUi } from "./ui-store";

/** Màn chat của một hội thoại (direct / nhóm / hỗ trợ dùng chung renderer – spec §5.10). */
export function ChatView() {
  const { conversationId = "" } = useParams();
  const { t } = useTranslation();
  const to = useShellPath();
  const query = useConversation(conversationId);
  const setActive = useChatUi((s) => s.setActive);
  const meId = useSession((s) => s.bootstrap?.me._id);
  const blocked = useSession((s) => s.bootstrap?.blockedUserIds);
  const conv = query.data;

  useEffect(() => {
    setActive(conversationId);
    return () => setActive(null);
  }, [conversationId, setActive]);

  const peerId = conv ? peerOf(conv, meId)?._id : undefined;
  useEffect(() => {
    if (peerId) ensurePresence([peerId]);
  }, [peerId]);

  if (!conv) {
    if (query.isError) {
      const removed = isApiError(query.error, "CHAT-403-003");
      return (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={<MessageSquareOff />}
            title={removed ? t("chat.removed") : t("chat.notFound")}
            description={removed ? undefined : errorMessage(query.error)}
            action={
              <Button asChild variant="secondary">
                <Link to={to("")}>{t("chat.back")}</Link>
              </Button>
            }
          />
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Spinner label={t("common.loading")} className="size-6" />
      </div>
    );
  }

  const iBlockedPeer = !!peerId && !!blocked?.includes(peerId);
  const disabledReason =
    conv.myRole === null ? t("composer.placeholderReadonly") : iBlockedPeer ? t("chat.youBlocked") : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <ChatHeader conversation={conv} />
      {/* key: feed/composer làm mới hoàn toàn khi đổi hội thoại (vị trí cuộn, vạch tin mới) */}
      <MessageFeed key={conv._id} conversation={conv} />
      <TypingIndicator conversationId={conv._id} />
      <Composer key={`c-${conv._id}`} conversation={conv} disabledReason={disabledReason} />
      <ForwardDialog />
      <DeleteMessageDialog />
    </div>
  );
}

function DeleteMessageDialog() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const message = useMessageDialogs((s) => s.remove);
  const close = useMessageDialogs((s) => s.openRemove);
  return (
    <ConfirmDialog
      open={!!message}
      onOpenChange={(open) => !open && close(null)}
      title={t("message.deleteConfirmTitle")}
      description={t("message.deleteConfirmBody")}
      confirmLabel={t("message.delete")}
      onConfirm={async () => {
        if (!message) return;
        try {
          await deleteMessage(qc, message.conversationId, message._id);
        } catch (error) {
          toast.error(error);
        }
      }}
    />
  );
}
