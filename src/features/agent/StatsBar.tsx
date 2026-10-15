import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSupportStats } from "@/features/support/api";

/** GET /api/support/stats – làm mới khi có support.updated (registerSupportHandlers). */
export function StatsBar() {
  const { t } = useTranslation();
  const stats = useSupportStats();
  if (!stats.data) return null;
  const s = stats.data;
  const items = [
    { key: "waiting", label: t("agent.stats.waiting"), value: String(s.waiting_agent) },
    { key: "mine", label: t("agent.stats.mine"), value: String(s.mineOpen) },
    { key: "open", label: t("agent.stats.open"), value: String(s.agent) },
  ];
  return (
    <dl className="flex min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-thin">
      {items.map((i) => (
        <div key={i.key} className="flex shrink-0 items-baseline gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
          <dt className="text-muted-foreground">{i.label}</dt>
          <dd className="font-semibold tabular-nums">{i.value}</dd>
        </div>
      ))}
      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
        <dt className="flex items-center gap-1 text-muted-foreground">
          <Star className="size-3.5" aria-hidden="true" />
          {t("agent.stats.rating")}
        </dt>
        <dd className="font-semibold tabular-nums">
          {s.averageRating !== null
            ? t("agent.stats.ratingValue", { value: s.averageRating, count: s.rated })
            : t("agent.stats.noRating")}
        </dd>
      </div>
    </dl>
  );
}
