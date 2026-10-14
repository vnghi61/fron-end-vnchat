import { Download, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Attachment } from "@/core/api/types";
import { cn } from "@/core/lib/cn";
import { formatBytes } from "@/features/shared/files";

// Đính kèm của tin type "file": lưới ảnh, player video/audio, thẻ tệp. Ảnh giữ chỗ theo width/height backend trả
// (aspect-ratio) để feed không nhảy khi ảnh tải xong.

const kindOf = (a: Attachment) =>
  a.kind ??
  (a.mime?.startsWith("image/")
    ? "image"
    : a.mime?.startsWith("video/")
      ? "video"
      : a.mime?.startsWith("audio/")
        ? "audio"
        : "file");

export function AttachmentGrid({ attachments, mine }: { attachments: Attachment[]; mine: boolean }) {
  const images = attachments.filter((a) => kindOf(a) === "image");
  const media = attachments.filter((a) => kindOf(a) === "video" || kindOf(a) === "audio");
  const files = attachments.filter((a) => kindOf(a) === "file");
  return (
    <div className="flex flex-col gap-1.5">
      {images.length > 0 && <ImageGrid images={images} />}
      {media.map((a) =>
        kindOf(a) === "video" ? (
          <video
            key={a.url}
            src={a.url}
            controls
            preload="metadata"
            className="max-h-80 w-full max-w-sm rounded-md bg-black"
            aria-label={a.name}
          >
            <track kind="captions" />
          </video>
        ) : (
          <audio key={a.url} src={a.url} controls preload="metadata" className="w-full max-w-xs" aria-label={a.name} />
        ),
      )}
      {files.map((a) => (
        <FileCard key={a.url} file={a} mine={mine} />
      ))}
    </div>
  );
}

function ImageGrid({ images }: { images: Attachment[] }) {
  const { t } = useTranslation();
  const single = images.length === 1;
  return (
    <div className={cn("grid gap-1 overflow-hidden rounded-md", single ? "max-w-xs" : "max-w-sm grid-cols-2")}>
      {images.map((img, i) => {
        const ratio = img.width && img.height ? `${img.width} / ${img.height}` : single ? "4 / 3" : "1 / 1";
        return (
          <a
            key={img.url}
            href={img.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("message.openImage", { name: img.name ?? `${i + 1}` })}
            className={cn("block overflow-hidden bg-muted", !single && images.length === 3 && i === 0 && "col-span-2")}
            style={{ aspectRatio: single ? ratio : "1 / 1" }}
          >
            <img
              src={img.url}
              alt={img.name ?? ""}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
              width={img.width}
              height={img.height}
            />
          </a>
        );
      })}
    </div>
  );
}

function FileCard({ file, mine }: { file: Attachment; mine: boolean }) {
  const { t } = useTranslation();
  const name = file.name || t("message.attachment");
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      download={file.name}
      aria-label={t("message.download", { name })}
      className={cn(
        "flex max-w-xs items-center gap-3 rounded-md border px-3 py-2 transition-colors",
        mine ? "border-white/30 hover:bg-white/10" : "border-border bg-surface hover:bg-muted",
      )}
    >
      <FileText className="size-8 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        {file.size !== undefined && <span className="block text-xs opacity-80">{formatBytes(file.size)}</span>}
      </span>
      <Download className="size-4 shrink-0 opacity-80" aria-hidden="true" />
    </a>
  );
}
