import { useQueryClient } from "@tanstack/react-query";
import { AlarmClock, Copy, EyeOff, Forward, Pencil, Pin, PinOff, Reply, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation, Message } from "@/core/api/types";
import { useMe } from "@/core/auth/session";
import type { ActionItem } from "@/core/ui/components/action-menu";
import { toast } from "@/core/ui/toast";
import { useChatUi } from "@/features/conversations/ui-store";
import { hideMessage, setPinned, unhideMessage } from "./api";
import { useMessageDialogs } from "./dialog-store";

// Quyền từng hành động theo bảng "Menu từng tin" (§4.4 tài liệu backend). Server vẫn kiểm tra lại – đây chỉ để ẩn nút.

export interface MessagePermissions {
  canReply: boolean;
  canReact: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  canUnpin: boolean;
  canForward: boolean;
  canHide: boolean;
  canCopy: boolean;
  /** Nhắc việc chỉ cho tài khoản đăng ký (requireUser). */
  canRemind: boolean;
}

export function messagePermissions(
  m: Message,
  conv: Conversation,
  meId: string | undefined,
  isRegistered: boolean,
): MessagePermissions {
  const member = conv.myRole !== null; // agent đang "xem" ticket chưa nhận: chỉ đọc
  const deleted = !!m.deletedAt;
  const mine = m.senderId === meId;
  const groupManager = conv.kind === "group" && (conv.myRole === "owner" || conv.myRole === "admin");
  const live = member && !deleted && m.type !== "system";
  return {
    canReply: live,
    canReact: live,
    canEdit: live && mine && ["text", "command", "file"].includes(m.type),
    canDelete: live && (mine || groupManager),
    canPin: live && !m.pinnedAt,
    canUnpin: member && !!m.pinnedAt && (conv.kind === "direct" || groupManager || m.pinnedBy === meId),
    canForward: live && isRegistered && ["text", "command", "file", "sticker"].includes(m.type),
    canHide: member,
    canCopy: !deleted && !!m.text,
    canRemind: isRegistered && !deleted && m.type !== "system",
  };
}

export function useMessageActions(m: Message, conv: Conversation): { items: ActionItem[]; perms: MessagePermissions } {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const me = useMe();
  const setComposerMode = useChatUi((s) => s.setComposerMode);
  const openForward = useMessageDialogs((s) => s.openForward);
  const openRemove = useMessageDialogs((s) => s.openRemove);
  const openRemind = useMessageDialogs((s) => s.openRemind);

  return useMemo(() => {
    const perms = messagePermissions(m, conv, me?._id, me?.kind === "user");
    const fail = (e: unknown) => toast.error(e);
    const items: ActionItem[] = [];
    if (perms.canReply)
      items.push({
        key: "reply",
        label: t("message.reply"),
        icon: <Reply />,
        onSelect: () => setComposerMode(conv._id, { kind: "reply", message: m }),
      });
    if (perms.canCopy)
      items.push({
        key: "copy",
        label: t("message.copy"),
        icon: <Copy />,
        onSelect: () =>
          void navigator.clipboard
            ?.writeText(m.text)
            .then(() => toast.success(t("message.copied")))
            .catch(fail),
      });
    if (perms.canEdit)
      items.push({
        key: "edit",
        label: t("message.edit"),
        icon: <Pencil />,
        onSelect: () => setComposerMode(conv._id, { kind: "edit", message: m }),
      });
    if (perms.canForward)
      items.push({ key: "forward", label: t("message.forward"), icon: <Forward />, onSelect: () => openForward(m) });
    if (perms.canPin)
      items.push({
        key: "pin",
        label: t("message.pin"),
        icon: <Pin />,
        onSelect: () => void setPinned(qc, m, true).catch(fail),
      });
    if (perms.canUnpin)
      items.push({
        key: "unpin",
        label: t("message.unpin"),
        icon: <PinOff />,
        onSelect: () => void setPinned(qc, m, false).catch(fail),
      });
    if (perms.canRemind)
      items.push({
        key: "remind",
        label: t("reminders.remindMe"),
        icon: <AlarmClock />,
        onSelect: () => openRemind(m),
      });
    if (perms.canHide)
      items.push({
        key: "hide",
        label: t("message.hide"),
        icon: <EyeOff />,
        onSelect: () =>
          void hideMessage(qc, m)
            .then(() =>
              toast.info(t("message.hidden"), {
                action: { label: t("message.undoHide"), onClick: () => void unhideMessage(qc, m).catch(fail) },
              }),
            )
            .catch(fail),
      });
    if (perms.canDelete) {
      items.push({ type: "separator", key: "sep-del" });
      items.push({
        key: "delete",
        label: t("message.delete"),
        icon: <Trash2 />,
        destructive: true,
        onSelect: () => openRemove(m),
      });
    }
    return { items, perms };
  }, [m, conv, me, t, qc, setComposerMode, openForward, openRemove, openRemind]);
}
