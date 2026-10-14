import { CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useConnection } from "@/core/realtime/socket";

/**
 * Trạng thái kết nối realtime dùng chung cho mọi shell. Không hiện gì khi bình thường; chỉ hiện khi rớt/đang nối lại,
 * và báo ngắn "Đã kết nối lại" sau khi hồi phục. role="status" để trình đọc màn hình thông báo một lần.
 */
export function ConnectionBanner() {
  const { t } = useTranslation();
  const state = useConnection((s) => s.state);
  const [showBack, setShowBack] = useState(false);
  const wasDown = useRef(false);

  useEffect(() => {
    if (state === "reconnecting" || state === "offline") wasDown.current = true;
    if (state === "ready" && wasDown.current) {
      wasDown.current = false;
      setShowBack(true);
      const id = setTimeout(() => setShowBack(false), 2500);
      return () => clearTimeout(id);
    }
  }, [state]);

  const down = state === "reconnecting" || state === "offline";
  const text =
    state === "offline"
      ? t("connection.offline")
      : state === "reconnecting"
        ? t("connection.reconnecting")
        : showBack
          ? t("connection.back")
          : "";

  return (
    <div role="status" aria-live="polite" className={down || showBack ? "" : "sr-only"}>
      {(down || showBack) && (
        <div
          className={
            down
              ? "flex items-center justify-center gap-2 bg-warning px-3 py-1.5 text-sm font-medium text-warning-foreground"
              : "flex items-center justify-center gap-2 bg-success px-3 py-1.5 text-sm font-medium text-success-foreground"
          }
        >
          {down &&
            (state === "offline" ? (
              <CloudOff className="size-4" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            ))}
          {text}
        </div>
      )}
    </div>
  );
}
