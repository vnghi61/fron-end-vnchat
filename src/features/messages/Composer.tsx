import { useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Reply, SendHorizontal, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation, ReplyPreview } from "@/core/api/types";
import { useLimits, useSession } from "@/core/auth/session";
import { cn } from "@/core/lib/cn";
import { IconButton } from "@/core/ui/components";
import { useMediaQuery } from "@/core/ui/hooks";
import { toast } from "@/core/ui/toast";
import { memberName } from "@/features/conversations/display";
import { useChatUi } from "@/features/conversations/ui-store";
import { editMessage, sendMessage } from "./api";
import { useTypingEmitter } from "./typing";

const EMPTY: Record<string, string> = {};
const MAX_ROWS_PX = 160;

/**
 * Ô soạn tin: Enter gửi (chuột/bàn phím), Shift+Enter xuống dòng; trên màn cảm ứng Enter xuống dòng, gửi bằng nút.
 * Đếm ký tự theo bootstrap.limits.maxMessageChars (server vẫn chặn CHAT-400-004). Bản nháp giữ theo hội thoại.
 */
export function Composer({
  conversation: conv,
  disabledReason,
  leading,
}: {
  conversation: Conversation;
  disabledReason?: string | null;
  /** Nút phụ bên trái (đính kèm, sticker – Phase 3). */
  leading?: ReactNode;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const limits = useLimits();
  const nicknames = useSession((s) => s.bootstrap?.nicknames ?? EMPTY);
  const mode = useChatUi((s) => s.composer[conv._id] ?? null);
  const setMode = useChatUi((s) => s.setComposerMode);
  const draft = useChatUi((s) => s.drafts[conv._id] ?? "");
  const setDraft = useChatUi((s) => s.setDraft);
  const coarse = useMediaQuery("(pointer: coarse)");
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(draft);
  const [saving, setSaving] = useState(false);
  const disabled = !!disabledReason;
  const typing = useTypingEmitter(conv._id, !disabled);
  const max = limits?.maxMessageChars ?? 8000;
  const length = [...text].length;
  const over = length > max;
  const editing = mode?.kind === "edit";

  // Đổi hội thoại: nạp nháp của hội thoại đó
  useEffect(() => setText(useChatUi.getState().drafts[conv._id] ?? ""), [conv._id]);

  // Vào chế độ sửa: nạp nội dung tin; trả lời/sửa → focus ô nhập
  useEffect(() => {
    if (mode?.kind === "edit") setText(mode.message.text);
    if (mode) ref.current?.focus();
  }, [mode]);

  // Tự giãn chiều cao theo nội dung (tối đa ~6 dòng)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }, [text]);

  const update = (value: string) => {
    setText(value);
    if (!editing) setDraft(conv._id, value);
    if (value) typing.ping();
    else typing.stop();
  };

  const cancelMode = () => {
    if (editing) setText(draft);
    setMode(conv._id, null);
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || over || disabled) return;
    typing.stop();
    if (editing && mode) {
      if (value === mode.message.text) return cancelMode();
      setSaving(true);
      try {
        await editMessage(qc, conv._id, mode.message._id, value);
        setMode(conv._id, null);
        setText(draft);
      } catch (error) {
        toast.error(error);
      } finally {
        setSaving(false);
      }
      return;
    }
    const reply = mode?.kind === "reply" ? mode.message : null;
    const replyPreview: ReplyPreview | null = reply
      ? {
          _id: reply._id,
          senderId: reply.senderId,
          senderName: memberName(conv, reply.senderId, nicknames),
          type: reply.type,
          text: reply.text,
          hasAttachments: reply.attachments.length > 0,
          deleted: !!reply.deletedAt,
        }
      : null;
    sendMessage(qc, conv._id, { text: value, ...(reply ? { replyTo: reply._id } : {}) }, { replyPreview });
    setText("");
    setDraft(conv._id, "");
    setMode(conv._id, null);
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && mode) {
      e.preventDefault();
      cancelMode();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  if (disabled) {
    return (
      <div className="shrink-0 border-t border-border bg-surface px-4 py-3 text-center text-sm text-muted-foreground safe-bottom">
        {disabledReason}
      </div>
    );
  }

  const target = mode?.message;
  return (
    <div className="shrink-0 border-t border-border bg-surface safe-bottom">
      {mode && target && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm">
          {editing ? (
            <Pencil className="size-4 text-primary-strong" aria-hidden="true" />
          ) : (
            <Reply className="size-4 text-primary-strong" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary-strong">
              {editing
                ? t("message.editing")
                : t("message.replyingTo", { name: memberName(conv, target.senderId, nicknames) })}
            </p>
            {!editing && <p className="truncate text-muted-foreground">{target.text || t("message.hasAttachment")}</p>}
          </div>
          <IconButton
            size="sm"
            label={editing ? t("message.cancelEdit") : t("message.cancelReply")}
            icon={<X />}
            onClick={cancelMode}
          />
        </div>
      )}
      <form
        className="flex items-end gap-1.5 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {leading}
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={ref}
            value={text}
            rows={1}
            onChange={(e) => update(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => typing.stop()}
            placeholder={t("composer.placeholder")}
            aria-label={t("composer.label")}
            aria-describedby={over ? `${conv._id}-limit` : undefined}
            aria-invalid={over || undefined}
            enterKeyHint={coarse ? "enter" : "send"}
            className={cn(
              "block max-h-40 min-h-10 w-full resize-none rounded-md border border-input bg-background px-3 py-2 leading-6 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 coarse:min-h-11",
              over && "border-danger",
            )}
          />
          {length > max * 0.9 && (
            <p
              id={`${conv._id}-limit`}
              className={cn(
                "px-1 pt-1 text-right text-xs tabular-nums",
                over ? "text-danger" : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {over ? t("composer.tooLong", { count: length - max }) : t("composer.charsLeft", { count: max - length })}
            </p>
          )}
        </div>
        <IconButton
          type="submit"
          variant="primary"
          label={editing ? t("composer.save") : t("composer.send")}
          icon={editing ? <Check /> : <SendHorizontal />}
          disabled={!text.trim() || over || saving}
          tooltip={false}
        />
      </form>
    </div>
  );
}
