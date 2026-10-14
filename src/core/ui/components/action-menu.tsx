import { ContextMenu as C, DropdownMenu as M } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/core/lib/cn";

// Một danh sách hành động, hai cách mở: nút "…" (DropdownMenu – chuột/bàn phím) và chuột phải / nhấn giữ trên cảm ứng
// (ContextMenu). Luôn có nút thay thế cho thao tác nhấn giữ (a11y).

export type ActionItem =
  | {
      type?: "item";
      key: string;
      label: string;
      icon?: ReactNode;
      destructive?: boolean;
      disabled?: boolean;
      onSelect: () => void;
    }
  | { type: "separator"; key: string }
  | { type: "label"; key: string; label: string };

const itemClass =
  "flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-sm px-2.5 text-sm outline-none coarse:min-h-11 data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted [&_svg]:size-4 [&_svg]:shrink-0";
const contentClass =
  "z-50 min-w-52 max-w-[calc(100vw-1rem)] animate-scale-in overflow-hidden rounded-md border border-border bg-surface-raised p-1 shadow-md";

function renderItems(items: ActionItem[], P: typeof M | typeof C) {
  return items.map((it) => {
    if (it.type === "separator") return <P.Separator key={it.key} className="my-1 h-px bg-border" />;
    if (it.type === "label")
      return (
        <P.Label key={it.key} className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
          {it.label}
        </P.Label>
      );
    return (
      <P.Item
        key={it.key}
        disabled={it.disabled}
        onSelect={it.onSelect}
        className={cn(itemClass, it.destructive ? "text-danger" : "text-foreground")}
      >
        {it.icon && (
          <span aria-hidden="true" className={cn("contents", !it.destructive && "text-muted-foreground")}>
            {it.icon}
          </span>
        )}
        {it.label}
      </P.Item>
    );
  });
}

export function ActionDropdown({
  items,
  trigger,
  align = "end",
  onOpenChange,
}: {
  items: ActionItem[];
  trigger: ReactElement;
  align?: "start" | "end" | "center";
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <M.Root onOpenChange={onOpenChange}>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content align={align} sideOffset={6} collisionPadding={8} className={contentClass}>
          {renderItems(items, M)}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

export function ActionContextMenu({
  items,
  children,
  disabled,
}: {
  items: ActionItem[];
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <C.Root>
      <C.Trigger asChild disabled={disabled}>
        {children}
      </C.Trigger>
      <C.Portal>
        <C.Content collisionPadding={8} className={contentClass}>
          {renderItems(items, C)}
        </C.Content>
      </C.Portal>
    </C.Root>
  );
}
