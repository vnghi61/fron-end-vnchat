import { createContext, useContext } from "react";
import type { PaneSize } from "@/core/ui/hooks";

export type ShellVariant = "full" | "compact" | "embed";

export interface ShellInfo {
  variant: ShellVariant;
  /** Kích thước pane đã áp giới hạn của shell (compact/embed không vượt "large"). */
  size: PaneSize;
  /** Tiền tố route của shell: "/app", "/compact", "/embed" – để link giữ nguyên chế độ. */
  base: string;
}

export const ShellContext = createContext<ShellInfo>({ variant: "full", size: "xlarge", base: "/app" });

export const useShell = () => useContext(ShellContext);

/** Đường dẫn trong shell hiện tại, vd. to("/c/123") → "/compact/c/123". */
export function useShellPath() {
  const { base } = useShell();
  return (path = "") => `${base}${path}`;
}
