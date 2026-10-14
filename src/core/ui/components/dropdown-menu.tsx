import { Check } from "lucide-react";
import { DropdownMenu as M } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/core/lib/cn";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuGroup = M.Group;

export function DropdownMenuContent({ className, align = "end", ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          "z-50 min-w-48 max-w-[calc(100vw-1rem)] animate-scale-in overflow-hidden rounded-md border border-border bg-surface-raised p-1 shadow-md",
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

export function DropdownMenuItem({
  className,
  icon,
  destructive,
  children,
  ...props
}: ComponentProps<typeof M.Item> & { icon?: ReactNode; destructive?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-sm px-2.5 text-sm outline-none coarse:min-h-11 data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted [&_svg]:size-4 [&_svg]:shrink-0",
        destructive ? "text-danger" : "text-foreground",
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden="true" className={cn("contents", !destructive && "text-muted-foreground")}>
          {icon}
        </span>
      )}
      {children}
    </M.Item>
  );
}

export function DropdownMenuCheckItem({ className, children, ...props }: ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem
      className={cn(
        "flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-sm px-2.5 text-sm outline-none coarse:min-h-11 data-highlighted:bg-muted",
        className,
      )}
      {...props}
    >
      <span className="flex size-4 items-center justify-center" aria-hidden="true">
        <M.ItemIndicator>
          <Check className="size-4" />
        </M.ItemIndicator>
      </span>
      {children}
    </M.CheckboxItem>
  );
}

export const DropdownMenuSeparator = () => <M.Separator className="my-1 h-px bg-border" />;

export const DropdownMenuLabel = ({ children }: { children: ReactNode }) => (
  <M.Label className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{children}</M.Label>
);
