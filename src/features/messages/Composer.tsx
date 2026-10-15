import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, Paperclip, Pencil, Plus, Reply, SendHorizontal, X } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type { Conversation, Id, ReplyPreview } from "@/core/api/types";
import { useFeatures, useLimits, useMe, useSession } from "@/core/auth/session";
import { cn } from "@/core/lib/cn";
import { IconButton } from "@/core/ui/components";
import { ActionDropdown, type ActionItem } from "@/core/ui/components/action-menu";
import { useMediaQuery } from "@/core/ui/hooks";
import { toast } from "@/core/ui/toast";
import { memberName } from "@/features/conversations/display";
import { useChatUi } from "@/features/conversations/ui-store";
import { CreatePollDialog } from "@/features/polls/CreatePollDialog";
import { formatBytes } from "@/features/shared/files";
import { UploadQueue } from "@/features/uploads/UploadQueue";
import {
  enqueueUploads,
  MAX_FILES_PER_MESSAGE,
  useUploads,
  validateFile,
  type UploadItem,
} from "@/features/uploads/uploads";
import { editMessage, sendMessage } from "./api";
import { EmojiStickerPicker } from "./composer/EmojiStickerPicker";
import {
  activeToken,
  applySuggestion,
  collectMentions,
  filterCommands,
  filterMembers,
  type MentionCandidate,
  type Suggestion,
} from "./composer/suggest";
import { SuggestionList } from "./composer/SuggestionList";
import { useTypingEmitter } from "./typing";

const EMPTY: Record<string, string> = {};
const NO_UPLOADS: UploadItem[] = [];
const MAX_ROWS_PX = 160;

/**
 * Ô soạn tin: Enter gửi (chuột/bàn phím), Shift+Enter xuống dòng; trên màn cảm ứng Enter xuống dòng, gửi bằng nút.
 * Đếm ký tự theo bootstrap.limits.maxMessageChars (server vẫn chặn CHAT-400-004). Bản nháp giữ theo hội thoại.
 * "+" → tệp (khi features.uploads) / bình chọn; emoji & sticker; gợi ý "@thành viên" và "/lệnh"; dán / kéo thả tệp.
 */
export function Composer({
  conversation: conv,
  disabledReason,
  leading,
}: {
  conversation: Conversation;
  disabledReason?: string | null;
  /** Nút phụ bên trái thêm vào (vd. widget). */
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

  const me = useMe();
  const features = useFeatures();
  const commandRules = useSession((s) => s.bootstrap?.commandRules);
  const uploads = useUploads((s) => s.byConversation[conv._id] ?? NO_UPLOADS);
  const fileRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [dragging, setDragging] = useState(false);
  const mentioned = useRef(new Map<Id, string>());
  const registered = me?.kind === "user";
  const canUpload = features.uploads && !editing;
  const uploadsBusy = uploads.some((u) => u.status !== "done");
  const readyFiles = uploads.filter((u) => u.status === "done" && u.result);

  // Gợi ý @thành viên / "/lệnh" theo token tại con trỏ
  const token = useMemo(() => activeToken(text, caret), [text, caret]);
  const candidates = useMemo<MentionCandidate[]>(
    () =>
      conv.members
        .filter((m) => m.user._id !== me?._id && m.user.kind !== "bot")
        .map((m) => ({ id: m.user._id, name: m.user.name, avatar: m.user.profileImage })),
    [conv.members, me?._id],
  );
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!token || editing) return [];
    if (`${token.kind}:${token.start}` === dismissed) return [];
    if (token.kind === "command")
      return filterCommands(commandRules ?? [], token.query).map((item) => ({ kind: "command", item }));
    if (conv.kind === "direct") return [];
    return filterMembers(candidates, token.query).map((item) => ({ kind: "mention", item }));
  }, [token, editing, dismissed, commandRules, candidates, conv.kind]);
  const showSuggestions = suggestions.length > 0;
  const active = Math.max(0, Math.min(activeIndex, suggestions.length - 1));

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

  const update = (value: string, caretAt = value.length) => {
    setText(value);
    setCaret(caretAt);
    setActiveIndex(0);
    if (!editing) setDraft(conv._id, value);
    if (value) typing.ping();
    else typing.stop();
  };

  const cancelMode = () => {
    if (editing) setText(draft);
    setMode(conv._id, null);
  };

  const focusAt = (position: number) =>
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(position, position);
    });

  const pick = (s: Suggestion) => {
    if (!token) return;
    const insert = s.kind === "command" ? `/${s.item.name}` : `@${s.item.name}`;
    if (s.kind === "mention") mentioned.current.set(s.item.id, s.item.name);
    const next = applySuggestion(text, token, insert);
    update(next.text, next.caret);
    focusAt(next.caret);
  };

  const addFiles = (files: File[]) => {
    if (!files.length || !canUpload) return;
    const room = MAX_FILES_PER_MESSAGE - uploads.length;
    if (files.length > room) toast.error(t("uploads.tooMany", { count: MAX_FILES_PER_MESSAGE }));
    const accepted: File[] = [];
    for (const file of files.slice(0, Math.max(0, room))) {
      const problem = limits ? validateFile(file, limits) : null;
      if (!problem) accepted.push(file);
      else if (problem.code === "CHAT-413-001")
        toast.error(t("uploads.tooLarge", { name: file.name, max: formatBytes(limits?.maxFileBytes) }));
      else toast.error(t("uploads.unsupported", { name: file.name }));
    }
    if (accepted.length) enqueueUploads(conv._id, accepted);
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files];
    if (files.length && canUpload) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    setDragging(false);
    if (!e.dataTransfer.files.length || !canUpload) return;
    e.preventDefault();
    addFiles([...e.dataTransfer.files]);
  };

  const sendSticker = (packId: string, stickerId: string) => {
    sendMessage(qc, conv._id, { type: "sticker", sticker: { packId, stickerId } });
    ref.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    update(`${text.slice(0, start)}${emoji}${text.slice(end)}`, start + emoji.length);
    focusAt(start + emoji.length);
  };

  const submit = async () => {
    const value = text.trim();
    if ((!value && !readyFiles.length) || over || disabled || uploadsBusy) return;
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
    const mentions = collectMentions(value, mentioned.current);
    sendMessage(
      qc,
      conv._id,
      {
        text: value,
        ...(reply ? { replyTo: reply._id } : {}),
        ...(mentions.length ? { mentions } : {}),
        ...(readyFiles.length ? { attachments: readyFiles.map((u) => u.result!) } : {}),
      },
      { replyPreview },
    );
    if (readyFiles.length) useUploads.getState().clear(conv._id);
    mentioned.current.clear();
    update("", 0);
    setMode(conv._id, null);
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((active + delta + suggestions.length) % suggestions.length);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey && !e.nativeEvent.isComposing) {
        const chosen = suggestions[active];
        if (chosen) {
          e.preventDefault();
          pick(chosen);
          return;
        }
      }
      if (e.key === "Escape" && token) {
        e.preventDefault();
        setDismissed(`${token.kind}:${token.start}`);
        return;
      }
    }
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
  const plusItems: ActionItem[] = [];
  if (canUpload)
    plusItems.push({
      key: "file",
      label: t("composerMore.file"),
      icon: <Paperclip />,
      onSelect: () => fileRef.current?.click(),
    });
  if (registered && conv.kind !== "support" && !editing)
    plusItems.push({
      key: "poll",
      label: t("composerMore.poll"),
      icon: <BarChart3 />,
      onSelect: () => setPolling(true),
    });
  const canSend = (!!text.trim() || readyFiles.length > 0) && !over && !saving && !uploadsBusy;

  return (
    <div
      className={cn(
        "relative shrink-0 border-t border-border bg-surface safe-bottom",
        dragging && "ring-2 ring-inset ring-primary",
      )}
      onDragOver={(e) => {
        if (canUpload && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
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
      <UploadQueue conversationId={conv._id} />
      <form
        className="flex items-end gap-1 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {leading}
        {plusItems.length > 0 && (
          <ActionDropdown
            align="start"
            items={plusItems}
            trigger={<IconButton label={t("composerMore.label")} icon={<Plus />} />}
          />
        )}
        {canUpload && (
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={limits?.allowedMime.join(",") || undefined}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              addFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        )}
        {!editing && <EmojiStickerPicker onEmoji={insertEmoji} onSticker={sendSticker} allowStickers={!mode} />}
        <div className="relative min-w-0 flex-1">
          {showSuggestions && (
            <SuggestionList id={listId} items={suggestions} active={active} onPick={pick} onHover={setActiveIndex} />
          )}
          <textarea
            ref={ref}
            value={text}
            rows={1}
            onChange={(e) => update(e.target.value, e.target.selectionStart)}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={() => typing.stop()}
            placeholder={t("composer.placeholder")}
            aria-label={t("composer.label")}
            aria-describedby={over ? `${conv._id}-limit` : undefined}
            aria-invalid={over || undefined}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls={showSuggestions ? listId : undefined}
            aria-activedescendant={showSuggestions ? `${listId}-${active}` : undefined}
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
          label={uploadsBusy ? t("uploads.waiting") : editing ? t("composer.save") : t("composer.send")}
          icon={editing ? <Check /> : <SendHorizontal />}
          disabled={!canSend}
          tooltip={false}
        />
      </form>
      {polling && <CreatePollDialog conversation={conv} onClose={() => setPolling(false)} />}
    </div>
  );
}
