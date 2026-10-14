import { MessagesSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Outlet, useParams } from "react-router-dom";
import { cn } from "@/core/lib/cn";
import { EmptyState } from "@/core/ui/components";
import { useShell } from "@/core/ui/shell";
import { InboxPane } from "./InboxPane";

/**
 * Khu Trò chuyện: container ≥ 900px → inbox (320–360px) + chat cạnh nhau; hẹp hơn → một pane tại một thời điểm
 * (inbox ở /app, chat ở /app/c/:id có nút quay lại). Inbox giữ mount khi đổi hội thoại để không mất vị trí cuộn.
 */
export function ChatsLayout() {
  const { size } = useShell();
  const { conversationId } = useParams();
  const wide = size === "large" || size === "xlarge";

  if (!wide) return conversationId ? <Outlet /> : <InboxPane />;

  return (
    <div className="flex h-full">
      <div className={cn("h-full shrink-0 border-r border-border", size === "xlarge" ? "w-[340px]" : "w-[300px]")}>
        <InboxPane />
      </div>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

export function NoChatSelected() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState icon={<MessagesSquare />} title={t("chat.selectTitle")} description={t("chat.selectHint")} />
    </div>
  );
}
