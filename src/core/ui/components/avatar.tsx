import { Avatar as A } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { initials } from "@/core/lib/initials";

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-20 text-2xl",
};

// Màu nền chữ viết tắt cố định theo tên (không mang nghĩa) – chọn từ token để đủ tương phản cả hai theme.
const tones = ["bg-primary-soft text-primary-strong", "bg-muted text-foreground"];

export function Avatar({
  src,
  name,
  size = "md",
  online,
  className,
  onlineLabel,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof sizes;
  /** undefined = không hiển thị chấm trạng thái. */
  online?: boolean;
  onlineLabel?: string;
  className?: string;
}) {
  const tone = tones[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % tones.length];
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <A.Root className={cn("inline-flex items-center justify-center overflow-hidden rounded-full", sizes[size])}>
        {src ? <A.Image src={src} alt="" className="size-full object-cover" loading="lazy" /> : null}
        <A.Fallback
          className={cn("flex size-full items-center justify-center font-semibold", tone)}
          delayMs={src ? 300 : 0}
        >
          {initials(name)}
        </A.Fallback>
      </A.Root>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-surface",
            size === "xs" || size === "sm" ? "size-2.5" : "size-3",
            online ? "bg-success" : "bg-input",
          )}
          role={onlineLabel ? "img" : undefined}
          aria-label={onlineLabel}
          aria-hidden={onlineLabel ? undefined : true}
        />
      )}
    </span>
  );
}
