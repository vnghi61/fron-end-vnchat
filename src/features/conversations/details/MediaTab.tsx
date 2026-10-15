import { ExternalLink, FileText, Link2, Music, Play } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Attachment, Conversation, Message } from "@/core/api/types";
import { errorMessage, tDynamic } from "@/core/i18n";
import { cn } from "@/core/lib/cn";
import { formatShortTime } from "@/core/lib/time";
import { Button, EmptyState, Skeleton } from "@/core/ui/components";
import { formatBytes } from "@/features/shared/files";
import { useMedia, type MediaKind } from "@/features/search/api";

const KINDS: MediaKind[] = ["image", "video", "audio", "file", "link"];

const kindOf = (a: Attachment): MediaKind =>
  a.kind ??
  (a.mime?.startsWith("image/")
    ? "image"
    : a.mime?.startsWith("video/")
      ? "video"
      : a.mime?.startsWith("audio/")
        ? "audio"
        : "file");

/** Thư viện media: GET /:id/media?kind= (mới nhất trước). Bấm một mục để nhảy tới tin chứa nó. */
export function MediaTab({ conversation: c, onJump }: { conversation: Conversation; onJump: (m: Message) => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<MediaKind>("image");
  const query = useMedia(c._id, kind);
  const messages = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-3 p-3">
      <div
        role="group"
        aria-label={t("details.media")}
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin"
      >
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors coarse:h-11",
              kind === k
                ? "border-transparent bg-primary-soft text-primary-strong"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tDynamic(`details.mediaKind.${k}`)}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <div className="grid grid-cols-3 gap-1" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-sm" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState title={errorMessage(query.error)} />
      ) : !messages.length ? (
        <EmptyState title={t("details.noMedia")} />
      ) : kind === "image" || kind === "video" ? (
        <ul className="grid grid-cols-3 gap-1">
          {messages.flatMap((m) =>
            m.attachments
              .filter((a) => kindOf(a) === kind)
              .map((a) => (
                <li key={`${m._id}-${a.url}`}>
                  <button
                    type="button"
                    onClick={() => onJump(m)}
                    aria-label={`${a.name || tDynamic(`details.mediaKind.${kind}`)} · ${formatShortTime(m.createdAt)}`}
                    className="relative block aspect-square w-full overflow-hidden rounded-sm bg-muted"
                  >
                    {kind === "image" ? (
                      <img src={a.url} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <>
                        <video
                          src={a.url}
                          preload="metadata"
                          muted
                          className="size-full object-cover"
                          aria-hidden="true"
                        />
                        <Play
                          className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                </li>
              )),
          )}
        </ul>
      ) : (
        <ul className="flex flex-col">
          {messages.flatMap((m) =>
            kind === "link"
              ? m.links.map((url) => <LinkRow key={`${m._id}-${url}`} url={url} message={m} onJump={onJump} />)
              : m.attachments
                  .filter((a) => kindOf(a) === kind)
                  .map((a) => <FileRow key={`${m._id}-${a.url}`} file={a} message={m} onJump={onJump} />),
          )}
        </ul>
      )}

      {query.hasNextPage && (
        <Button
          variant="ghost"
          className="self-center"
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t("common.loadMore")}
        </Button>
      )}
    </div>
  );
}

function RowShell({
  icon,
  title,
  subtitle,
  href,
  openLabel,
  onJump,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
  openLabel: string;
  onJump: () => void;
}) {
  return (
    <li className="flex items-center gap-1 rounded-md hover:bg-muted">
      <button
        type="button"
        onClick={onJump}
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left coarse:py-3"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong [&_svg]:size-4"
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </button>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={openLabel}
        className="flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface hover:text-foreground coarse:size-11"
      >
        <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    </li>
  );
}

function FileRow({ file, message, onJump }: { file: Attachment; message: Message; onJump: (m: Message) => void }) {
  const { t } = useTranslation();
  const name = file.name || t("message.attachment");
  return (
    <RowShell
      icon={kindOf(file) === "audio" ? <Music /> : <FileText />}
      title={name}
      subtitle={[formatBytes(file.size), formatShortTime(message.createdAt)].filter(Boolean).join(" · ")}
      href={file.url}
      openLabel={t("message.download", { name })}
      onJump={() => onJump(message)}
    />
  );
}

function LinkRow({ url, message, onJump }: { url: string; message: Message; onJump: (m: Message) => void }) {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* giữ nguyên chuỗi */
  }
  return (
    <RowShell icon={<Link2 />} title={host} subtitle={url} href={url} openLabel={url} onJump={() => onJump(message)} />
  );
}
