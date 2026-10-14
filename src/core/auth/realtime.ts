import { onSocketEvent } from "@/core/realtime/socket";
import { useSession } from "./session";

// Event realtime thuộc phạm vi phiên/tài khoản (docs/realtime.md): thu hồi phiên, chặn, biệt danh.

export function registerSessionHandlers(): () => void {
  const offs = [
    onSocketEvent("session.revoked", ({ reason }) => {
      useSession
        .getState()
        .expire(
          reason === "disabled"
            ? "auth.revokedDisabled"
            : reason === "logout_all"
              ? "auth.revokedLogoutAll"
              : "auth.sessionExpired",
        );
    }),
    onSocketEvent("block.updated", ({ userId, blocked }) => useSession.getState().setBlocked(userId, blocked)),
    onSocketEvent("nickname.updated", ({ userId, nickname }) => useSession.getState().setNickname(userId, nickname)),
  ];
  return () => offs.forEach((off) => off());
}
