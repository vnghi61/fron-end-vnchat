import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/core/lib/cn";
import { useReturnFocus } from "@/core/ui/focus-return";
import { IconButton } from "./icon-button";

// Dialog (giữa màn) và Sheet (trượt từ cạnh) – Radix lo focus trap, ESC; useReturnFocus trả focus về nút mở kể cả khi
// dialog mở bằng state (không có Dialog.Trigger).

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

type ContentProps = {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Ẩn tiêu đề khỏi giao diện nhưng vẫn cho trình đọc màn hình. */
  hideTitle?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  hideTitle,
  size = "md",
}: ContentProps) {
  const { t } = useTranslation();
  const focus = useReturnFocus();
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 animate-fade-in bg-overlay" />
      <D.Content
        {...focus}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(var(--app-height,100dvh)-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 animate-scale-in flex-col rounded-lg border border-border bg-surface-raised shadow-lg focus-visible:outline-none",
          sizes[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <D.Title className={cn("text-lg font-semibold", hideTitle && "sr-only")}>{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close asChild>
            <IconButton label={t("common.close")} icon={<X />} size="sm" tooltip={false} className="-mr-2 -mt-1" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}

/** Panel trượt từ phải (desktop) – dùng cho chi tiết hội thoại dạng overlay, bộ lọc… */
export function SheetContent({
  title,
  description,
  children,
  side = "right",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  side?: "right" | "bottom";
  className?: string;
}) {
  const { t } = useTranslation();
  const focus = useReturnFocus();
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 animate-fade-in bg-overlay" />
      <D.Content
        {...focus}
        className={cn(
          "fixed z-40 flex flex-col bg-surface-raised shadow-lg focus-visible:outline-none",
          side === "right"
            ? "inset-y-0 right-0 w-full max-w-sm animate-slide-in-right border-l border-border safe-top safe-bottom"
            : "inset-x-0 bottom-0 max-h-[85%] animate-slide-in-bottom rounded-t-xl border-t border-border safe-bottom",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <D.Title className="truncate text-base font-semibold">{title}</D.Title>
            <D.Description className={description ? "text-sm text-muted-foreground" : "sr-only"}>
              {description ?? title}
            </D.Description>
          </div>
          <D.Close asChild>
            <IconButton label={t("common.close")} icon={<X />} size="sm" tooltip={false} />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
