import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/http";
import { tokenStore } from "@/core/api/token";
import type { Bootstrap } from "@/core/api/types";
import { registerSessionHandlers } from "@/core/auth/realtime";
import { useSession } from "@/core/auth/session";
import { connectSocket, disconnectSocket, reconnectSocket } from "@/core/realtime/socket";

// Ghép socket + các nhóm handler (lớp app được phép import cả core lẫn features).
// Một lần gọi cho mỗi phiên đăng nhập; trả hàm dọn dẹp.

export function startRealtime(queryClient: QueryClient): () => void {
  let cleanupHandlers: (() => void) | null = null;

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
      if (reconnect) void onReconnected(queryClient);
    },
    onAuthProblem: () => void verifySession(),
  });

  cleanupHandlers = registerSessionHandlers();

  // App quay lại foreground / có mạng lại → nối lại nếu đang rớt (Socket.IO không phát lại event lỡ → sync khi ready).
  const wake = () => {
    if (document.visibilityState === "visible") reconnectSocket();
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);

  return () => {
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("online", wake);
    cleanupHandlers?.();
    disconnectSocket();
  };
}

async function onReconnected(queryClient: QueryClient) {
  // Phase 1: làm mới bootstrap (unread, quyền) và mọi query đang mở. Phase 2 thay bằng /api/sync.
  await useSession
    .getState()
    .refreshBootstrap()
    .catch(() => undefined);
  await queryClient.invalidateQueries();
}
