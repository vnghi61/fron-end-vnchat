import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/core/lib/cn";
import { Tooltip } from "./tooltip";

const iconButtonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center rounded-sm transition-colors duration-(--duration-fast) disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-primary-soft aria-pressed:text-primary-strong aria-expanded:bg-muted",
        secondary: "border border-border bg-surface text-foreground hover:bg-muted",
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        danger: "text-danger hover:bg-muted",
      },
      size: {
        sm: "size-8 coarse:size-11 [&_svg]:size-4",
        md: "size-10 coarse:size-11 [&_svg]:size-5",
        lg: "size-11 [&_svg]:size-6",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface IconButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children">,
    VariantProps<typeof iconButtonVariants> {
  /** Bắt buộc: tên truy cập + nội dung tooltip (nút chỉ có icon). */
  label: string;
  icon: ReactNode;
  tooltip?: boolean;
  badge?: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, className, variant, size, tooltip = true, badge, type, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type={type ?? "button"}
        aria-label={label}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        <span aria-hidden="true" className="contents">
          {icon}
        </span>
        {badge}
      </button>
    );
    return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
  },
);
IconButton.displayName = "IconButton";
