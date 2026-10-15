import { useTranslation } from "react-i18next";
import type { SupportStatus } from "@/core/api/types";
import { Badge } from "@/core/ui/components";

const tones = { waiting_agent: "warning", agent: "primary", closed: "neutral" } as const;

/** Trạng thái yêu cầu – chữ + màu (không chỉ dựa vào màu). */
export function StatusBadge({ status }: { status: SupportStatus }) {
  const { t } = useTranslation();
  return <Badge tone={tones[status]}>{t(`support.statusLabel.${status}`)}</Badge>;
}
