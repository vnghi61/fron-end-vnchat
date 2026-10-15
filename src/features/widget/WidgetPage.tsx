import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Headset, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { isApiError } from "@/core/api/errors";
import type { Conversation, Id } from "@/core/api/types";
import { useBranding, useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { applyServerErrors } from "@/core/lib/forms";
import { storage } from "@/core/lib/storage";
import { formatShortTime } from "@/core/lib/time";
import { useConnection } from "@/core/realtime/socket";
import { Button, EmptyState, Field, IconButton, Input, Spinner, Textarea } from "@/core/ui/components";
import { useContainerSize } from "@/core/ui/hooks";
import { ShellContext, type ShellInfo } from "@/core/ui/shell";
import { toast } from "@/core/ui/toast";
import { FormAlert } from "@/features/auth/AuthLayout";
import { useConversation } from "@/features/conversations/api";
import { useChatUi } from "@/features/conversations/ui-store";
import { Composer } from "@/features/messages/Composer";
import { MessageFeed } from "@/features/messages/MessageFeed";
import { TypingIndicator } from "@/features/messages/TypingIndicator";
import { startSupport, useMySupport } from "@/features/support/api";
import { SupportBanner } from "@/features/support/SupportBanner";
import { hostPage, startVisitorSession, visitorToken } from "./session";

// Widget hỗ trợ cho khách (màn 15): launcher ↔ panel. Tài liệu này chạy transport cách ly (main.tsx) nên phiên khách
// không đụng tới phiên thành viên. Khi nằm trong iframe (Phase 6 – loader điều khiển kích thước), panel lấp đầy iframe.

const OPEN_KEY = "vnchat.widget.open";

const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

export function WidgetPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(
    () => new URLSearchParams(window.location.search).get("open") === "1" || storage.get(OPEN_KEY, "session") === "1",
  );
  const launcherRef = useRef<HTMLButtonElement>(null);

  const toggle = (next: boolean) => {
    setOpen(next);
    storage.set(OPEN_KEY, next ? "1" : "0", "session");
    if (!next) requestAnimationFrame(() => launcherRef.current?.focus());
  };

  return (
    <div className="h-full w-full bg-transparent">
      {open ? (
        <WidgetPanel onMinimize={() => toggle(false)} />
      ) : (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => toggle(true)}
          aria-label={t("widget.open")}
          className={
            embedded
              ? "flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground"
              : "fixed bottom-4 right-4 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-offset-4 motion-reduce:transition-none safe-bottom"
          }
        >
          <MessageCircle className="size-6" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function WidgetPanel({ onMinimize }: { onMinimize: () => void }) {
  const { t } = useTranslation();
  const status = useSession((s) => s.status);
  const branding = useBranding();
  const connection = useConnection((s) => s.state);
  const { ref, size } = useContainerSize<HTMLElement>();
  const shell = useMemo<ShellInfo>(
    () => ({ variant: "embed", size: size === "xlarge" ? "large" : size, base: "/widget" }),
    [size],
  );
  const [unavailable, setUnavailable] = useState(false);
  const resumed = useRef(false);

  // Khách cũ (còn visitorToken) mà token phiên hết hạn → tự lấy phiên mới, giữ nguyên lịch sử.
  useEffect(() => {
    if (status !== "anonymous" || resumed.current || !visitorToken()) return;
    resumed.current = true;
    startVisitorSession().catch((error: unknown) => {
      if (isApiError(error, "CHAT-403-001")) setUnavailable(true);
    });
  }, [status]);

  const title = branding?.appName ? `${branding.appName} – ${t("widget.title")}` : t("widget.title");
  const subtitle = connection === "reconnecting" || connection === "offline" ? t("connection.reconnecting") : null;

  return (
    <ShellContext.Provider value={shell}>
      <section
        ref={ref}
        aria-label={t("widget.title")}
        className={
          embedded
            ? "flex size-full flex-col overflow-hidden bg-background"
            : "fixed inset-0 flex flex-col overflow-hidden bg-background sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(640px,calc(100dvh-2rem))] sm:w-[min(400px,calc(100vw-2rem))] sm:rounded-lg sm:border sm:border-border sm:shadow-lg"
        }
      >
        <header className="flex min-h-14 shrink-0 items-center gap-3 bg-primary px-3 text-primary-foreground safe-top">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-white/15"
          >
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <Headset className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-xs opacity-90">{subtitle}</p>}
          </div>
          <IconButton
            label={t("widget.minimize")}
            icon={<ChevronDown />}
            onClick={onMinimize}
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          />
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          {unavailable ? (
            <EmptyState
              className="flex-1"
              icon={<Headset />}
              title={t("widget.unavailable")}
              description={t("widget.unavailableBody")}
            />
          ) : status === "authenticated" ? (
            <WidgetHome onUnavailable={() => setUnavailable(true)} />
          ) : status === "anonymous" && !visitorToken() ? (
            <VisitorForm onUnavailable={() => setUnavailable(true)} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Spinner label={t("common.loading")} className="size-6" />
            </div>
          )}
        </div>
      </section>
    </ShellContext.Provider>
  );
}

// ---------- form khách ----------

const visitorSchema = z.object({
  name: z.string().trim().max(100),
  email: z.union([z.literal(""), z.string().trim().email("widget.emailInvalid")]),
  message: z.string().trim().max(8000),
});
type VisitorValues = z.infer<typeof visitorSchema>;

function VisitorForm({ onUnavailable }: { onUnavailable: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VisitorValues>({
    resolver: zodResolver(visitorSchema),
    defaultValues: { name: "", email: "", message: "" },
  });

  const submit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await startVisitorSession({ name: v.name || undefined, email: v.email || undefined });
      const page = hostPage();
      await startSupport(qc, { text: v.message || undefined, meta: page ? { page } : undefined });
    } catch (error) {
      if (isApiError(error, "CHAT-403-001")) return onUnavailable();
      setFormError(applyServerErrors(error, setError, ["name", "email"]));
    }
  });

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 scrollbar-thin"
      onSubmit={(e) => void submit(e)}
    >
      <p className="text-base font-medium">{t("widget.greeting")}</p>
      <FormAlert message={formError} />
      <Field label={t("widget.name")} optional={t("common.optional")}>
        <Input autoComplete="name" maxLength={100} {...register("name")} />
      </Field>
      <Field
        label={t("widget.email")}
        optional={t("common.optional")}
        error={errors.email?.message ? t(errors.email.message as "widget.emailInvalid") : undefined}
      >
        <Input type="email" inputMode="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field label={t("widget.message")} optional={t("common.optional")}>
        <Textarea rows={3} maxLength={8000} {...register("message")} />
      </Field>
      <p className="text-xs text-muted-foreground">{t("widget.privacy")}</p>
      <Button type="submit" loading={isSubmitting} className="mt-auto">
        {t("widget.start")}
      </Button>
    </form>
  );
}

// ---------- sau khi có phiên ----------

function WidgetHome({ onUnavailable }: { onUnavailable: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mine = useMySupport();
  const [viewing, setViewing] = useState<Id | null>(null);
  const [starting, setStarting] = useState(false);
  const open = mine.data?.find((c) => c.support?.status !== "closed");
  // Giữ hội thoại đang xem kể cả khi nó vừa bị đóng (để khách thấy "đã kết thúc" + đánh giá), chỉ về màn chính khi bấm
  useEffect(() => {
    if (open && !viewing) setViewing(open._id);
  }, [open, viewing]);
  const activeId = viewing ?? open?._id ?? null;

  const start = async () => {
    setStarting(true);
    try {
      const page = hostPage();
      const c = await startSupport(qc, { meta: page ? { page } : undefined });
      setViewing(c._id);
    } catch (error) {
      if (isApiError(error, "CHAT-403-001")) onUnavailable();
      else toast.error(error);
    } finally {
      setStarting(false);
    }
  };

  if (activeId)
    return (
      <WidgetChat
        conversationId={activeId}
        onBack={activeId !== open?._id ? () => setViewing(null) : undefined}
        onNewConversation={(c) => setViewing(c._id)}
      />
    );
  if (mine.isPending)
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Spinner label={t("common.loading")} className="size-6" />
      </div>
    );
  const history = mine.data ?? [];
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 scrollbar-thin">
      <p className="text-base font-medium">{t("widget.greeting")}</p>
      {mine.isError && <FormAlert message={errorMessage(mine.error)} />}
      <Button onClick={() => void start()} loading={starting}>
        {t("widget.start")}
      </Button>
      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-muted-foreground">{t("support.history")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("support.noHistory")}</p>
        ) : (
          <ul className="flex flex-col">
            {history.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => setViewing(c._id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted coarse:py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {c.lastMessage?.preview || t("support.statusLabel.closed")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {c.support ? t(`support.statusLabel.${c.support.status}`) : ""} · {formatShortTime(c.updatedAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function WidgetChat({
  conversationId,
  onBack,
  onNewConversation,
}: {
  conversationId: Id;
  onBack?: () => void;
  onNewConversation: (c: Conversation) => void;
}) {
  const { t } = useTranslation();
  const query = useConversation(conversationId);
  const setActive = useChatUi((s) => s.setActive);
  useEffect(() => {
    setActive(conversationId);
    return () => setActive(null);
  }, [conversationId, setActive]);

  const conv = query.data;
  if (!conv)
    return query.isError ? (
      <EmptyState className="flex-1" title={errorMessage(query.error)} />
    ) : (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Spinner label={t("common.loading")} className="size-6" />
      </div>
    );
  const closed = conv.support?.status === "closed";
  return (
    <>
      {onBack && (
        <div className="shrink-0 border-b border-border px-2 py-1">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            {t("widget.back")}
          </Button>
        </div>
      )}
      <SupportBanner conversation={conv} onNewConversation={onNewConversation} />
      <MessageFeed key={conv._id} conversation={conv} />
      <TypingIndicator conversationId={conv._id} />
      <Composer
        key={`c-${conv._id}`}
        conversation={conv}
        disabledReason={closed ? t("support.closedReadonly") : null}
      />
    </>
  );
}
