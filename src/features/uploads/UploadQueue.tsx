import { FileText, ImageIcon, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Id } from "@/core/api/types";
import { errorMessage } from "@/core/i18n";
import { cn } from "@/core/lib/cn";
import { formatBytes } from "@/features/shared/files";
import { removeUpload, retryUpload, useUploads, type UploadItem } from "./uploads";

const EMPTY: UploadItem[] = [];

/** Chip từng tệp đang chờ gửi: tiến trình, lỗi + tải lại, bỏ tệp. Tin chỉ gửi được khi mọi tệp đã "done". */
export function UploadQueue({ conversationId }: { conversationId: Id }) {
  const { t } = useTranslation();
  const items = useUploads((s) => s.byConversation[conversationId] ?? EMPTY);
  if (!items.length) return null;
  return (
    <ul aria-label={t("uploads.queue")} className="flex gap-2 overflow-x-auto px-2 pt-2 scrollbar-thin">
      {items.map((item) => (
        <UploadChip key={item.id} item={item} conversationId={conversationId} />
      ))}
    </ul>
  );
}

function UploadChip({ item, conversationId }: { item: UploadItem; conversationId: Id }) {
  const { t } = useTranslation();
  const isImage = item.file.type.startsWith("image/");
  const preview = useMemo(() => (isImage ? URL.createObjectURL(item.file) : null), [isImage, item.file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const pct = Math.round(item.progress * 100);
  const failed = item.status === "failed";
  return (
    <li
      className={cn(
        "relative flex w-52 shrink-0 items-center gap-2 overflow-hidden rounded-md border bg-background p-1.5 pr-1",
        failed ? "border-danger/60" : "border-border",
      )}
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted text-muted-foreground">
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : isImage ? (
          <ImageIcon className="size-4" aria-hidden="true" />
        ) : (
          <FileText className="size-4" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{item.file.name}</span>
        <span
          className={cn("block truncate text-xs", failed ? "text-danger" : "text-muted-foreground")}
          aria-live="polite"
        >
          {failed ? (
            <>
              <TriangleAlert className="mr-1 inline size-3" aria-hidden="true" />
              {item.error ? errorMessage(item.error) : t("uploads.failed")}
            </>
          ) : item.status === "uploading" ? (
            `${pct}%`
          ) : (
            formatBytes(item.file.size)
          )}
        </span>
      </span>
      {failed && (
        <button
          type="button"
          onClick={() => retryUpload(conversationId, item.id)}
          aria-label={t("uploads.retry")}
          className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={() => removeUpload(conversationId, item.id)}
        aria-label={t("uploads.remove", { name: item.file.name })}
        className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      {item.status === "uploading" && (
        <span
          role="progressbar"
          aria-label={t("uploads.uploading", { name: item.file.name, progress: pct })}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="absolute inset-x-0 bottom-0 h-0.5 bg-muted"
        >
          <span className="block h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </span>
      )}
    </li>
  );
}
