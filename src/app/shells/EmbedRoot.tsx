import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useSession } from "@/core/auth/session";
import { applyHostPreference, hostBridge, useHostMessages } from "@/core/embed/bridge";

/**
 * Gốc của /embed/* (màn 25): báo `ready`, số chưa đọc cho host, nhận theme/locale/navigate/viewport từ host đã xác thực
 * (allowlist + origin + source + shape – core/embed). Đăng nhập nằm dưới /embed để CSP frame-ancestors cho phép.
 */
export function EmbedRoot() {
  const navigate = useNavigate();
  const unread = useSession((s) => s.bootstrap?.unreadTotal ?? null);

  useEffect(() => hostBridge().send({ type: "ready" }), []);
  useEffect(() => {
    if (unread !== null) hostBridge().send({ type: "unread:change", count: unread });
  }, [unread]);

  useHostMessages((msg) => {
    if (msg.type === "navigate") navigate(msg.route);
    else applyHostPreference(msg);
  });

  return <Outlet />;
}
