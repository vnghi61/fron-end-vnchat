import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Headset, Star } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "@/core/api/types";
import { Button, ConfirmDialog } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { closeSupport, startSupport } from "./api";
import { RatingForm } from "./RatingForm";

/**
 * Trạng thái yêu cầu hỗ trợ phía KHÁCH (màn 16): chờ nhân viên → "<tên> đang hỗ trợ bạn" → đã kết thúc + đánh giá.
 * Dùng chung cho app thành viên và widget. Khi đã đóng, gửi tin sẽ bị CHAT-409-003 → gợi ý mở cuộc mới.
 */
export function SupportBanner({
  conversation: c,
  onNewConversation,
}: {
  conversation: Conversation;
  onNewConversation: (c: Conversation) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [starting, setStarting] = useState(false);
  const support = c.support;
  if (!support) return null;
  const closed = support.status === "closed";

  const startNew = async () => {
    setStarting(true);
    try {
      onNewConversation(await startSupport(qc));
    } catch (error) {
      toast.error(error);
    } finally {
      setStarting(false);
    }
  };

  const text =
    support.status === "waiting_agent"
      ? t("support.status.waiting_agent")
      : support.status === "agent"
        ? support.assignee
          ? t("support.status.agent", { name: support.assignee.name })
          : t("support.status.agentUnknown")
        : t("support.status.closed");
  const Icon = support.status === "waiting_agent" ? Clock : support.status === "agent" ? Headset : CheckCircle2;

  return (
    <div className="shrink-0 border-b border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          className={support.status === "agent" ? "size-4 text-success" : "size-4 text-muted-foreground"}
        />
        <p role="status" aria-live="polite" className="min-w-0 flex-1 truncate text-sm">
          {text}
        </p>
        {!closed && (
          <Button variant="ghost" size="sm" aria-label={t("support.endLabel")} onClick={() => setConfirm(true)}>
            {t("support.end")}
          </Button>
        )}
      </div>
      {closed && (
        <div className="mt-2 flex flex-col gap-3 pb-1">
          {support.rating ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="size-4 fill-warning text-warning" aria-hidden="true" />
              {t("support.yourRating", { count: support.rating })}
            </p>
          ) : (
            <RatingForm conversationId={c._id} />
          )}
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            loading={starting}
            onClick={() => void startNew()}
          >
            {t("support.newChat")}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("support.endConfirm")}
        description={t("support.endBody")}
        confirmLabel={t("support.end")}
        onConfirm={async () => {
          try {
            await closeSupport(qc, c._id);
            toast.success(t("support.ended"));
          } catch (error) {
            toast.error(error);
          }
        }}
      />
    </div>
  );
}
