import { Check } from "lucide-react";
import { Checkbox as C, Popover as P, Switch as S, Tabs as T, ToggleGroup as G } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/core/lib/cn";

// Primitive nhỏ dựa trên Radix (switch, checkbox, tabs, segmented, popover) + badge, skeleton, empty state.

export function Switch({ className, ...props }: ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2 border-transparent bg-input transition-colors duration-(--duration-fast) data-[state=checked]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-5 rounded-full bg-white shadow-sm transition-transform duration-(--duration-fast) data-[state=checked]:translate-x-4" />
    </S.Root>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-input bg-surface transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <C.Indicator>
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </C.Indicator>
    </C.Root>
  );
}

export const Tabs = T.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn("flex items-center gap-1 overflow-x-auto border-b border-border scrollbar-thin", className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  children,
  count,
  ...props
}: ComponentProps<typeof T.Trigger> & { count?: number }) {
  return (
    <T.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground coarse:h-11 data-[state=active]:border-primary data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>
      )}
    </T.Trigger>
  );
}

export const TabsContent = T.Content;

/** Nhóm lựa chọn một (vd. theme sáng/tối/hệ thống). */
export function Segmented<V extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: V;
  onValueChange: (v: V) => void;
  options: { value: V; label: string; icon?: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <G.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as V)}
      aria-label={label}
      className={cn("inline-flex rounded-md border border-border bg-muted p-1", className)}
    >
      {options.map((o) => (
        <G.Item
          key={o.value}
          value={o.value}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors coarse:h-11 data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-sm [&_svg]:size-4"
        >
          {o.icon && (
            <span aria-hidden="true" className="contents">
              {o.icon}
            </span>
          )}
          {o.label}
        </G.Item>
      ))}
    </G.Root>
  );
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export function PopoverContent({ className, align = "start", ...props }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          "z-50 max-w-[calc(100vw-1rem)] animate-scale-in rounded-md border border-border bg-surface-raised p-3 shadow-md focus-visible:outline-none",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}

const badgeTones = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary-strong",
  success: "border border-success/40 text-success",
  warning: "border border-warning/40 text-warning",
  danger: "border border-danger/40 text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof badgeTones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Số đếm chưa đọc – có nhãn đọc màn hình, không phải live region. */
export function CountBadge({ count, label, className }: { count: number; label: string; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground",
        className,
      )}
      aria-label={label}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-sm bg-muted", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      {icon && (
        <div
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary-strong [&_svg]:size-6"
        >
          {icon}
        </div>
      )}
      <div className="max-w-sm">
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
