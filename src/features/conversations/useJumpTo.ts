import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Id, Message } from "@/core/api/types";
import { useShellPath } from "@/core/ui/shell";

/** Mở hội thoại và nhảy tới một tin (`?msg=<id>&seq=<n>` – feed tự tải lùi tới khi có tin đó, contract map B6). */
export function useJumpTo() {
  const navigate = useNavigate();
  const location = useLocation();
  const to = useShellPath();
  return useCallback(
    (m: Pick<Message, "_id" | "seq" | "conversationId">, opts: { closePanel?: boolean } = {}) => {
      const params = new URLSearchParams(opts.closePanel ? "" : location.search);
      params.set("msg", m._id);
      params.set("seq", String(m.seq));
      if (opts.closePanel) params.delete("panel");
      navigate(`${to(`/c/${m.conversationId}`)}?${params.toString()}`, {
        replace: location.pathname.endsWith(m.conversationId),
      });
    },
    [navigate, location.search, location.pathname, to],
  );
}

export const panelParam = "panel";
export type PanelName = "details";

export function useDetailsPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const open = new URLSearchParams(location.search).get(panelParam) === "details";
  const set = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(location.search);
      if (next) {
        params.set(panelParam, "details");
        // push: nút back (Android WebView/trình duyệt) đóng panel trước khi rời màn chat
        navigate({ search: params.toString() }, { state: { panelPushed: true } });
      } else if ((location.state as { panelPushed?: boolean } | null)?.panelPushed) navigate(-1);
      else {
        params.delete(panelParam);
        navigate({ search: params.toString() }, { replace: true });
      }
    },
    [navigate, location.search, location.state],
  );
  return [open, set] as const;
}

export type JumpTarget = { messageId: Id; seq: number | null };
