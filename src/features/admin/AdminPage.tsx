import { Check, Copy, ShieldOff, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toApiError } from "@/core/api/errors";
import { errorMessage } from "@/core/i18n";
import { Button, Dialog, DialogContent, EmptyState } from "@/core/ui/components";

/** Khung một mục quản trị: tiêu đề + hành động, nội dung cuộn, rộng tối đa vừa đọc. */
export function AdminPage({
  title,
  actions,
  wide,
  children,
}: {
  title: string;
  actions?: ReactNode;
  /** Bảng rộng (ma trận phân quyền): dùng hết bề ngang thay vì cột đọc 64rem. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className={wide ? "w-full p-4" : "mx-auto w-full max-w-5xl p-4"}>{children}</div>
      </div>
    </div>
  );
}

/** Lỗi tải một mục: 403 → "không có quyền" (B3 – bootstrap không liệt kê quyền từng mục), còn lại → thông điệp + thử lại. */
export function AdminError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  if (toApiError(error).isForbidden)
    return <EmptyState icon={<ShieldOff />} title={t("admin.forbidden")} description={t("admin.forbiddenBody")} />;
  return (
    <EmptyState
      icon={<TriangleAlert />}
      title={errorMessage(error)}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        )
      }
    />
  );
}

/** Secret webhook / API key: chỉ có trong response tạo mới – hiện một lần, không lưu ở đâu khác. */
export function SecretOnceDialog({ label, secret, onClose }: { label: string; secret: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t("admin.secretOnce.title")}
        description={t("admin.secretOnce.body")}
        footer={<Button onClick={onClose}>{t("admin.secretOnce.done")}</Button>}
      >
        <p className="mb-1.5 text-sm font-medium">{label}</p>
        <div className="flex items-stretch gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
            {secret}
          </code>
          <Button
            variant="secondary"
            onClick={() =>
              void navigator.clipboard?.writeText(secret).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
            }
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? t("admin.secretOnce.copied") : t("admin.secretOnce.copy")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
