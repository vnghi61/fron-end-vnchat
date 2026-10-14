import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { createQueryClient } from "@/core/api/query";
import { useSession } from "@/core/auth/session";
import "@/core/i18n";
import { TooltipProvider } from "@/core/ui/components";
import { useAppHeight } from "@/core/ui/hooks";
import { useTheme } from "@/core/ui/theme";
import { startRealtime } from "./realtime";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  useAppHeight();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SessionEffects />
        {children}
        <AppToaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

/** Khởi tạo phiên, nối realtime khi đăng nhập, dọn cache khi đăng xuất, áp branding. */
function SessionEffects() {
  const queryClient = useQueryClient();
  const status = useSession((s) => s.status);
  const primaryColor = useSession((s) => s.bootstrap?.branding.primaryColor ?? null);
  const appName = useSession((s) => s.bootstrap?.branding.appName ?? null);

  useEffect(() => {
    void useSession.getState().init();
  }, []);

  useEffect(() => {
    if (status === "authenticated") return startRealtime(queryClient);
    if (status === "anonymous") queryClient.clear();
  }, [status, queryClient]);

  useEffect(() => {
    useTheme.getState().setBrandColor(primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    if (appName) document.title = appName;
  }, [appName]);

  return null;
}

function AppToaster() {
  const resolved = useTheme((s) => s.resolved);
  return (
    <Toaster
      theme={resolved}
      position="top-center"
      closeButton
      offset={{ top: "max(16px, env(safe-area-inset-top))" }}
      toastOptions={{ className: "font-sans" }}
    />
  );
}
