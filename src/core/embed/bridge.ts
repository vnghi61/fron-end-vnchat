import { useEffect, useRef } from "react";
import { config } from "@/core/config";
import { setLocale } from "@/core/i18n";
import { useTheme } from "@/core/ui/theme";
import { parseHostMessage, resolveParentOrigin, type ChatToHost, type HostToChat, type OutgoingMessage } from "./protocol";

// Kênh tới trang host: iframe (postMessage với origin đã qua allowlist) hoặc WebView native (đối tượng host inject sẵn).
// Không có kênh hợp lệ → mọi send là no-op (app vẫn chạy bình thường). Không bao giờ gửi token/cookie/nội dung tin.

type Listener = (msg: HostToChat) => void;

interface NativeHost {
  webkit?: { messageHandlers?: { vnchat?: { postMessage: (m: unknown) => void } } };
  VNChatAndroid?: { postMessage: (m: string) => void };
  ReactNativeWebView?: { postMessage: (m: string) => void };
  vnchatHost?: { receive: (m: unknown) => void };
}

export const inIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // bị chặn truy cập top = chắc chắn nằm trong iframe khác origin
  }
})();

function nativeSender(): ((m: OutgoingMessage) => void) | null {
  const w = window as unknown as NativeHost;
  if (w.webkit?.messageHandlers?.vnchat) return (m) => w.webkit!.messageHandlers!.vnchat!.postMessage(m);
  if (w.VNChatAndroid) return (m) => w.VNChatAndroid!.postMessage(JSON.stringify(m));
  if (w.ReactNativeWebView) return (m) => w.ReactNativeWebView!.postMessage(JSON.stringify(m));
  return null;
}

export interface HostBridge {
  kind: "iframe" | "native" | null;
  /** Origin trang cha đã xác thực (chỉ khi kind = iframe). */
  parentOrigin: string | null;
  send: (msg: ChatToHost) => void;
  subscribe: (listener: Listener) => () => void;
}

function createBridge(): HostBridge {
  const listeners = new Set<Listener>();
  const emit = (data: unknown) => {
    const msg = parseHostMessage(data);
    if (msg) listeners.forEach((l) => l(msg));
    else if (config.isDev) console.warn("[vnchat-embed] bỏ qua message không hợp lệ", data);
  };

  let post: ((m: OutgoingMessage) => void) | null = null;
  let kind: HostBridge["kind"] = null;
  let parentOrigin: string | null = null;

  const native = nativeSender();
  if (native) {
    kind = "native";
    post = native;
    // Host native gọi window.vnchatHost.receive(msg) – cùng bước kiểm tra shape (không có origin vì không qua postMessage)
    (window as unknown as NativeHost).vnchatHost = { receive: emit };
  } else if (inIframe) {
    parentOrigin = resolveParentOrigin({
      allowlist: config.embedParentOrigins,
      ancestorOrigins: window.location.ancestorOrigins ? Array.from(window.location.ancestorOrigins) : null,
      referrer: document.referrer,
    });
    if (parentOrigin) {
      kind = "iframe";
      const origin = parentOrigin;
      post = (m) => window.parent.postMessage(m, origin); // không bao giờ "*"
      window.addEventListener("message", (e) => {
        if (e.origin !== origin || e.source !== window.parent) return;
        emit(e.data);
      });
    }
  }

  let lastHeight = -1;
  let pendingHeight: number | null = null;
  let readySent = false;
  return {
    kind,
    parentOrigin,
    send(msg) {
      if (!post) return;
      if (msg.type === "ready") {
        // một lần cho mỗi lần tải trang (StrictMode/remount không phát lại)
        if (readySent) return;
        readySent = true;
      }
      if (msg.type === "resize") {
        // gộp theo frame, bỏ thay đổi < 2px
        if (Math.abs(msg.height - lastHeight) < 2) return;
        const first = pendingHeight === null;
        pendingHeight = msg.height;
        if (first)
          requestAnimationFrame(() => {
            if (pendingHeight === null) return;
            lastHeight = pendingHeight;
            post?.({ source: "vnchat-embed", v: 1, type: "resize", height: pendingHeight });
            pendingHeight = null;
          });
        return;
      }
      post({ ...msg, source: "vnchat-embed", v: 1 });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let bridge: HostBridge | null = null;
export const hostBridge = (): HostBridge => (bridge ??= createBridge());

/** Áp tuỳ chọn hiển thị host gửi – KHÔNG lưu vào storage (không ghi đè lựa chọn của người dùng ở app standalone). */
export function applyHostPreference(msg: HostToChat) {
  if (msg.type === "theme:set") useTheme.getState().setPreference(msg.theme, { persist: false });
  else if (msg.type === "locale:set") setLocale(msg.locale, false);
  else if (msg.type === "viewport:set") document.documentElement.style.setProperty("--app-height", `${msg.height}px`);
}

/** Nghe message host (đã kiểm tra); handler luôn là bản mới nhất. */
export function useHostMessages(handler: (msg: HostToChat) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => hostBridge().subscribe((m) => ref.current(m)), []);
}
