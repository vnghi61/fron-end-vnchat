import { useQueryClient } from "@tanstack/react-query";
import { Info, MessageSquareOff } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isApiError } from "@/core/api/errors";
import { usePermissions, useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { Button, ConfirmDialog, Dialog, EmptyState, IconButton, SheetContent, Spinner } from "@/core/ui/components";
import { useShell, useShellPath } from "@/core/ui/shell";
import { toast } from "@/core/ui/toast";
import { deleteMessage } from "@/features/messages/api";
import { Composer } from "@/features/messages/Composer";
import { useMessageDialogs } from "@/features/messages/dialog-store";
import { ForwardDialog } from "@/features/messages/ForwardDialog";
import { MessageFeed } from "@/features/messages/MessageFeed";
import { TypingIndicator } from "@/features/messages/TypingIndicator";
import { ensurePresence } from "@/features/people/presence";
import { ReminderDialog } from "@/features/reminders/ReminderDialog";
import { isSupportCustomer } from "@/features/support/queue";
import { SupportBanner } from "@/features/support/SupportBanner";
import { useConversation } from "./api";
import { ChatHeader } from "./ChatHeader";
import { DetailsPanel } from "./details/DetailsPanel";
import { peerOf } from "./display";
import { useChatUi } from "./ui-store";
import { useDetailsPanel } from "./useJumpTo";

/** Màn chat của một hội thoại (direct / nhóm / hỗ trợ dùng chung renderer – spec §5.10). */
export function ChatView() {
  const { conversationId = "" } = useParams();
  const { t } = useTranslation();
  const to = useShellPath();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const query = useConversation(conversationId);
  const setActive = useChatUi((s) => s.setActive);
  const meId = useSession((s) => s.bootstrap?.me._id);
  const blocked = useSession((s) => s.bootstrap?.blockedUserIds);
  const conv = query.data;
  const { size } = useShell();
  const [detailsOpen, setDetailsOpen] = useDetailsPanel();
  const inlineDetails = size === "xlarge";

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
  const customer = isSupportCustomer(conv, meId);
  const disabledReason =
    conv.myRole === null
      ? t("composer.placeholderReadonly")
      : customer && conv.support?.status === "closed"
        ? t("support.closedReadonly")
        : iBlockedPeer
          ? t("chat.youBlocked")
          : null;

  const infoButton = (
    <IconButton
      label={detailsOpen ? t("details.close") : t("details.open")}
      icon={<Info />}
      aria-pressed={detailsOpen}
      onClick={() => setDetailsOpen(!detailsOpen)}
    />
  );

  return (
    <div className="flex h-full bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader conversation={conv} actions={infoButton} />
        {customer && <SupportBanner conversation={conv} onNewConversation={(c) => navigate(to(`/c/${c._id}`))} />}
        {conv.kind === "support" && !customer && permissions.agent && (
          <p className="shrink-0 border-b border-border bg-surface px-3 py-2 text-sm">
            <Link
              to={`/support/t/${conv._id}`}
              className="font-medium text-primary-strong underline-offset-4 hover:underline"
            >
              {t("agent.openInConsole")}
            </Link>
          </p>
        )}
        {/* key: feed/composer làm mới hoàn toàn khi đổi hội thoại (vị trí cuộn, vạch tin mới) */}
        <MessageFeed key={conv._id} conversation={conv} />
        <TypingIndicator conversationId={conv._id} />
        <Composer key={`c-${conv._id}`} conversation={conv} disabledReason={disabledReason} />
      </div>
      {inlineDetails && detailsOpen && (
        <aside aria-label={t("details.title")} className="w-80 shrink-0 border-l border-border bg-surface">
          <DetailsPanel key={conv._id} conversation={conv} inline onClose={() => setDetailsOpen(false)} />
        </aside>
      )}
      {!inlineDetails && (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent title={t("details.title")}>
            <DetailsPanel key={conv._id} conversation={conv} inline={false} onClose={() => setDetailsOpen(false)} />
          </SheetContent>
        </Dialog>
      )}
      <ForwardDialog />
      <DeleteMessageDialog />
      <RemindDialogHost />
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

function RemindDialogHost() {
  const message = useMessageDialogs((s) => s.remind);
  const close = useMessageDialogs((s) => s.openRemind);
  return message ? <ReminderDialog key={message._id} message={message} onClose={() => close(null)} /> : null;
}
