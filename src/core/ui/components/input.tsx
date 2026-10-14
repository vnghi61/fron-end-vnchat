import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/core/lib/cn";

const base =
  "w-full rounded-sm border border-input bg-surface px-3 text-foreground placeholder:text-muted-foreground transition-colors duration-(--duration-fast) focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, "h-10 coarse:h-11", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(base, "min-h-20 py-2", className)} {...props} />,
);
Textarea.displayName = "Textarea";

/** Select native: dễ dùng trên mobile/WebView, accessible sẵn. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(base, "h-10 pr-8 coarse:h-11", className)} {...props} />
  ),
);
Select.displayName = "Select";
