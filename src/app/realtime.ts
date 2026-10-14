import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/http";
import { tokenStore } from "@/core/api/token";
import type { Bootstrap } from "@/core/api/types";
import { registerSessionHandlers } from "@/core/auth/realtime";
import { useSession } from "@/core/auth/session";
import { connectSocket, disconnectSocket, getSocket, reconnectSocket } from "@/core/realtime/socket";
import { registerConversationHandlers } from "@/features/conversations/realtime";
import { resetSyncCursor, syncNow } from "@/features/conversations/sync";
import { registerTypingHandlers } from "@/features/messages/typing";
import { registerPresenceHandlers, resetPresence } from "@/features/people/presence";

// Ghép socket + các nhóm handler (lớp app được phép import cả core lẫn features). Một lần cho mỗi phiên đăng nhập.

export function startRealtime(queryClient: QueryClient): () => void {
  resetSyncCursor(useSession.getState().bootstrap?.serverTime ?? null);

  const verifySession = async () => {
    try {
      const bootstrap = await api.get<Bootstrap>("/api/me/bootstrap", { skipAuthRedirect: true });
      useSession.setState({ bootstrap });
      reconnectSocket(); // phiên còn hợp lệ: server ngắt vì lý do khác → nối lại
    } catch {
      useSession.getState().expire("auth.sessionExpired");
    }
  };

  connectSocket({
    token: tokenStore.get(),
    onReady: ({ reconnect }) => {
      // Lần đầu: dữ liệu vừa tải từ REST. Kết nối lại: bù event bị lỡ.
      if (reconnect) void syncNow(queryClient).catch(() => undefined);
    },
    onAuthProblem: () => void verifySession(),
  });

  const meId = () => useSession.getState().bootstrap?.me._id;
  const cleanups = [
    registerSessionHandlers(),
    registerConversationHandlers(queryClient),
    registerTypingHandlers(meId),
    registerPresenceHandlers(),
  ];

  // App quay lại foreground / có mạng lại → nối lại nếu đang rớt (sync chạy khi `ready`). Nếu socket vẫn sống nhưng
  // app nằm nền lâu (WebView/mobile có thể treo JS) → vẫn sync để chắc không lỡ event.
  let hiddenAt: number | null = null;
  const wake = () => {
    if (document.visibilityState !== "visible") {
      hiddenAt = Date.now();
      return;
    }
    const wasLongHidden = hiddenAt !== null && Date.now() - hiddenAt > 30_000;
    hiddenAt = null;
    if (getSocket()?.connected) {
      if (wasLongHidden) void syncNow(queryClient).catch(() => undefined);
    } else reconnectSocket();
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);

  return () => {
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("online", wake);
    cleanups.forEach((off) => off());
    disconnectSocket();
    resetPresence();
    resetSyncCursor(null);
  };
}
