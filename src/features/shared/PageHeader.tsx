import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IconButton } from "@/core/ui/components";

/** Header trang chuẩn: nút quay lại (tuỳ chọn), tiêu đề, hành động bên phải. Tôn trọng safe-area trên. */
export function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
  leading,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backTo?: string;
  actions?: ReactNode;
  leading?: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 safe-top">
      {backTo && <IconButton label={t("common.back")} icon={<ArrowLeft />} onClick={() => navigate(backTo)} />}
      {leading}
      <div className={backTo || leading ? "min-w-0 flex-1" : "min-w-0 flex-1 pl-2"}>
        <h1 className="truncate text-base font-semibold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}
