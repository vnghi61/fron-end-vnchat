import { Headset } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/core/ui/components";
import { useShell } from "@/core/ui/shell";
import { QUEUE_TABS, type QueueFilter, type QueueTab } from "@/features/support/queue";
import { QueuePane } from "./QueuePane";
import { TicketView } from "./TicketView";

const parseTab = (v: string | null): QueueTab => (QUEUE_TABS.includes(v as QueueTab) ? (v as QueueTab) : "waiting");

/**
 * /support và /support/t/:id. Pane rộng: hàng đợi + yêu cầu; hẹp: một cột (yêu cầu có nút quay lại).
 * Bộ lọc giữ trên URL (?tab=&tag=) – state là nguồn sự thật, URL chỉ đồng bộ một chiều.
 */
export function AgentConsole() {
  const { t } = useTranslation();
  const { conversationId = null } = useParams();
  const [params, setParams] = useSearchParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { size } = useShell();
  const [filter, setFilter] = useState<QueueFilter>(() => ({
    tab: parseTab(params.get("tab")),
    tag: params.get("tag") ?? "",
  }));

  useEffect(() => {
    const next = new URLSearchParams();
    if (filter.tab !== "waiting") next.set("tab", filter.tab);
    if (filter.tag) next.set("tag", filter.tag);
    if (next.toString() !== window.location.search.replace(/^\?/, "")) setParams(next, { replace: true });
  }, [filter, setParams]);

  const wide = size === "large" || size === "xlarge";
  const queue = <QueuePane filter={filter} onFilter={setFilter} activeId={conversationId} />;

  if (!wide)
    return conversationId ? (
      <TicketView key={conversationId} conversationId={conversationId} onBack={() => navigate(`/support${search}`)} />
    ) : (
      queue
    );

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="w-[22rem] shrink-0 border-r border-border bg-surface">{queue}</div>
      {conversationId ? (
        <TicketView key={conversationId} conversationId={conversationId} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={<Headset />} title={t("agent.select")} description={t("agent.selectHint")} />
        </div>
      )}
    </div>
  );
}
