import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Info, MoreVertical, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isApiError } from "@/core/api/errors";
import { qk } from "@/core/api/query";
import type { Conversation, Id, SupportAgent } from "@/core/api/types";
import { usePermissions, useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { emitWithAck, useConnection } from "@/core/realtime/socket";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IconButton,
  SheetContent,
  Spinner,
} from "@/core/ui/components";
import { ActionDropdown, type ActionItem } from "@/core/ui/components/action-menu";
import { useShell } from "@/core/ui/shell";
import { toast } from "@/core/ui/toast";
import { useConversation } from "@/features/conversations/api";
import { useChatUi } from "@/features/conversations/ui-store";
import { Composer } from "@/features/messages/Composer";
import { MessageFeed } from "@/features/messages/MessageFeed";
import { TypingIndicator } from "@/features/messages/TypingIndicator";
import { applySupportConversation, closeSupport, supportApi } from "@/features/support/api";
import { StatusBadge } from "./StatusBadge";
import { TicketInfo } from "./TicketInfo";
import { TransferDialog } from "./TransferDialog";

/**
 * Một yêu cầu trong console (màn 18). Chưa nhận → xem chỉ đọc + `support:watch` để nhận realtime (đăng ký lại sau mỗi
 * lần socket `ready`). Nhận trùng → CHAT-409-006: báo, tải lại, giữ chế độ xem. Chỉ người phụ trách (hoặc admin – server
 * kiểm tra) mới chuyển / trả / đóng.
 */
export function TicketView({ conversationId, onBack }: { conversationId: Id; onBack?: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useConversation(conversationId);
  const meId = useSession((s) => s.bootstrap?.me._id);
  const permissions = usePermissions();
  const readyCount = useConnection((s) => s.readyCount);
  const setActive = useChatUi((s) => s.setActive);
  const { size } = useShell();
  // cột phải ở pane ≥1200px (mở sẵn), Sheet ở màn hẹp (đóng sẵn) – hai trạng thái riêng để đổi kích thước không bật Sheet
  const wide = size === "xlarge";
  const [inlineInfo, setInlineInfo] = useState(true);
  const [sheetInfo, setSheetInfo] = useState(false);
  const infoOpen = wide ? inlineInfo : sheetInfo;
  const setInfoOpen = wide ? setInlineInfo : setSheetInfo;
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState<"transfer" | "assign" | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const c = query.data;
  const watching = !!c && c.myRole === null;

  useEffect(() => {
    setActive(conversationId);
    return () => setActive(null);
  }, [conversationId, setActive]);

  // Xem yêu cầu chưa nhận: tham gia room conv:<id> (mất khi reconnect → đăng ký lại theo readyCount)
  useEffect(() => {
    if (!watching || readyCount === 0) return;
    void emitWithAck("support:watch", { conversationId });
    return () => void emitWithAck("support:unwatch", { conversationId });
  }, [watching, conversationId, readyCount]);

  if (!c) {
    return query.isError ? (
      <EmptyState className="flex-1" title={errorMessage(query.error)} />
    ) : (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Spinner label={t("common.loading")} className="size-6" />
      </div>
    );
  }
  const support = c.support;
  if (!support) return <EmptyState className="flex-1" title={t("chat.notFound")} />;

  const mine = support.assigneeId === meId;
  const handling = support.status === "agent" && (mine || permissions.admin);
  const customerName = support.customer?.name || c.title;

  const run = async (key: string, action: () => Promise<Conversation | void>, success: string) => {
    setBusy(key);
    try {
      const result = await action();
      if (result) applySupportConversation(qc, result);
      toast.success(success);
    } catch (error) {
      toast.error(error);
      // xung đột (người khác nhận trước / trạng thái đã đổi) → tải lại để thấy trạng thái thật
      if (isApiError(error, "CHAT-409-006") || isApiError(error, "CHAT-409-000") || isApiError(error, "CHAT-409-003")) {
        void qc.invalidateQueries({ queryKey: qk.conversation(c._id) });
        void qc.invalidateQueries({ queryKey: qk.supportQueueAll });
      }
    } finally {
      setBusy(null);
    }
  };

  const pickAgent = (agent: SupportAgent) => {
    const mode = picker;
    setPicker(null);
    if (mode === "transfer")
      void run("transfer", () => supportApi.transfer(c._id, agent._id), t("agent.transferred", { name: agent.name }));
    else void run("assign", () => supportApi.assign(c._id, agent._id), t("agent.assigned", { name: agent.name }));
  };

  const menu: ActionItem[] = [];
  if (handling) {
    menu.push({ key: "transfer", label: t("agent.transfer"), onSelect: () => setPicker("transfer") });
    menu.push({
      key: "release",
      label: t("agent.release"),
      onSelect: () => void run("release", () => supportApi.release(c._id), t("agent.released")),
    });
  }
  if (support.status === "waiting_agent" && permissions.admin)
    menu.push({ key: "assign", label: t("agent.assignTo"), onSelect: () => setPicker("assign") });
  if (support.status !== "closed" && (handling || support.status === "waiting_agent"))
    menu.push({ key: "close", label: t("agent.close"), destructive: true, onSelect: () => setConfirmClose(true) });

  const notice =
    support.status === "closed"
      ? t("agent.closedNote")
      : support.status === "agent" && !mine
        ? t("agent.otherAgent", { name: support.assignee?.name ?? "" })
        : watching
          ? t("agent.watching")
          : null;
  // lý do khoá ô soạn chính là thông báo trạng thái (chỉ đọc / người khác xử lý / đã đóng) – không lặp ở chỗ khác
  const disabledReason = watching || support.status !== "agent" ? (notice ?? t("composer.placeholderReadonly")) : null;

  const info = <TicketInfo conversation={c} canEdit={support.status !== "closed"} />;

  return (
    <div className="flex h-full min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 safe-top">
          {onBack && <IconButton label={t("agent.back")} icon={<ArrowLeft />} onClick={onBack} />}
          {!onBack && <Avatar src={support.customer?.profileImage} name={customerName} className="ml-1" />}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{customerName}</h2>
            <div className="flex items-center gap-1.5">
              <StatusBadge status={support.status} />
              {support.assignee && (
                <span className="truncate text-xs text-muted-foreground">{support.assignee.name}</span>
              )}
            </div>
          </div>
          {support.status === "waiting_agent" && (
            <Button
              size="sm"
              loading={busy === "claim"}
              onClick={() => void run("claim", () => supportApi.assign(c._id), t("agent.claimed"))}
            >
              {t("agent.claim")}
            </Button>
          )}
          {support.status === "closed" && (
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "reopen"}
              onClick={() => void run("reopen", () => supportApi.reopen(c._id), t("agent.reopened"))}
            >
              {t("agent.reopen")}
            </Button>
          )}
          <IconButton
            label={infoOpen ? t("common.close") : t("agent.openDetails")}
            icon={<Info />}
            aria-pressed={infoOpen}
            onClick={() => setInfoOpen(!infoOpen)}
          />
          {menu.length > 0 && (
            <ActionDropdown items={menu} trigger={<IconButton label={t("agent.details")} icon={<MoreVertical />} />} />
          )}
        </header>
        <MessageFeed key={c._id} conversation={c} />
        <TypingIndicator conversationId={c._id} />
        <Composer key={`c-${c._id}`} conversation={c} disabledReason={disabledReason} />
      </div>
      {wide ? (
        infoOpen && (
          <aside
            aria-label={t("agent.details")}
            className="flex w-80 shrink-0 flex-col border-l border-border bg-surface"
          >
            <div className="flex min-h-14 items-center justify-between border-b border-border px-3">
              <h2 className="text-base font-semibold">{t("agent.details")}</h2>
              <IconButton label={t("common.close")} icon={<X />} size="sm" onClick={() => setInfoOpen(false)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{info}</div>
          </aside>
        )
      ) : (
        <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
          <SheetContent title={t("agent.details")}>{info}</SheetContent>
        </Dialog>
      )}
      {picker && (
        <TransferDialog
          title={picker === "transfer" ? t("agent.transferTitle") : t("agent.assignTo")}
          excludeId={support.assigneeId}
          onPick={pickAgent}
          onClose={() => setPicker(null)}
        />
      )}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t("agent.closeConfirm")}
        description={t("agent.closeBody")}
        confirmLabel={t("agent.close")}
        onConfirm={() => run("close", () => closeSupport(qc, c._id), t("agent.closed"))}
      />
    </div>
  );
}
