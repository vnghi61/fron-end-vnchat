/*!
 * VNChat widget loader (bridge v1) – docs/embed-webview-architecture.md §3–4.
 *
 *   <script src="https://chat.example.vn/vnchat-widget.js" async
 *           data-site-id="shop-01" data-theme="system" data-locale="vi" data-placement="bottom-right"></script>
 *
 * - Không phụ thuộc thư viện, không đọc cookie/storage của trang host, không chèn CSS toàn cục (style inline).
 * - Launcher vẽ ở trang host; iframe /widget chỉ tạo khi mở lần đầu.
 * - Chỉ nhận message có origin === origin của chính file này VÀ source === iframe; gửi với targetOrigin cụ thể (không "*").
 * - Không có API key/token nào ở đây: data-site-id chỉ là nhãn công khai.
 * - Trang host phải nằm trong allowlist (VITE_EMBED_PARENT_ORIGINS + CSP frame-ancestors của VNChat), nếu không trình
 *   duyệt chặn iframe.
 */
(function () {
  "use strict";
  if (window.VNChat && window.VNChat.__loaded) return;

  var script = document.currentScript;
  if (!script || !script.src) return;
  var origin = new URL(script.src).origin;
  var data = script.dataset || {};
  var pick = function (value, allowed, fallback) {
    return allowed.indexOf(value) !== -1 ? value : fallback;
  };
  var theme = pick(data.theme, ["light", "dark", "system"], "system");
  var locale = pick(data.locale, ["vi", "en"], "vi");
  var placement = pick(data.placement, ["bottom-right", "bottom-left"], "bottom-right");
  var siteId = /^[A-Za-z0-9_-]{1,64}$/.test(data.siteId || "") ? data.siteId : "";
  var side = placement === "bottom-left" ? "left" : "right";
  var labels = { vi: "Mở hỗ trợ trực tuyến", en: "Open live support" };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var launcher = null;
  var frame = null;
  var badge = null;
  var hidden = false;
  var isOpen = false;
  var listeners = { open: [], close: [], unread: [], ready: [] };

  function css(el, styles) {
    for (var key in styles) el.style[key] = styles[key];
  }

  function emit(name, value) {
    (listeners[name] || []).forEach(function (fn) {
      try {
        fn(value);
      } catch (e) {
        /* lỗi của host không làm hỏng widget */
      }
    });
  }

  function send(message) {
    if (!frame || !frame.contentWindow) return;
    message.source = "vnchat-host";
    message.v = 1;
    frame.contentWindow.postMessage(message, origin);
  }

  function layout() {
    if (!frame) return;
    var small = window.innerWidth < 480;
    css(frame, small
      ? { top: "0", bottom: "0", left: "0", right: "0", width: "100%", height: "100%", borderRadius: "0" }
      : {
          top: "auto",
          bottom: "16px",
          left: side === "left" ? "16px" : "auto",
          right: side === "right" ? "16px" : "auto",
          width: "min(400px, calc(100vw - 32px))",
          height: "min(640px, calc(100vh - 32px))",
          borderRadius: "12px",
        });
  }

  function createLauncher() {
    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.setAttribute("aria-label", labels[locale]);
    launcher.setAttribute("aria-expanded", "false");
    css(launcher, {
      position: "fixed",
      bottom: "16px",
      zIndex: "2147483000",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "0",
      padding: "0",
      cursor: "pointer",
      background: "#5865F2",
      color: "#fff",
      boxShadow: "0 8px 24px rgba(17, 24, 39, .25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: reduceMotion ? "none" : "transform .15s ease",
    });
    launcher.style[side] = "16px";
    launcher.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
    badge = document.createElement("span");
    badge.setAttribute("aria-hidden", "true");
    css(badge, {
      position: "absolute",
      top: "-2px",
      right: "-2px",
      minWidth: "20px",
      height: "20px",
      padding: "0 5px",
      borderRadius: "10px",
      background: "#dc2626",
      color: "#fff",
      font: "600 12px/20px system-ui, sans-serif",
      display: "none",
      boxSizing: "border-box",
    });
    launcher.appendChild(badge);
    launcher.addEventListener("click", open);
    document.body.appendChild(launcher);
  }

  function createFrame() {
    var params = new URLSearchParams({ open: "1", theme: theme, locale: locale });
    if (siteId) params.set("siteId", siteId);
    frame = document.createElement("iframe");
    frame.src = origin + "/widget?" + params.toString();
    frame.title = "VNChat";
    frame.setAttribute("allow", "clipboard-write");
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads",
    );
    // để iframe biết origin trang host qua referrer khi trình duyệt không có location.ancestorOrigins
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    css(frame, {
      position: "fixed",
      zIndex: "2147483001",
      border: "0",
      background: "transparent",
      colorScheme: "normal",
      boxShadow: "0 12px 40px rgba(17, 24, 39, .25)",
      display: "none",
    });
    document.body.appendChild(frame);
    layout();
  }

  function open() {
    if (hidden) return;
    if (!frame) createFrame();
    else send({ type: "open" });
    frame.style.display = "block";
    if (launcher) {
      launcher.style.display = "none";
      launcher.setAttribute("aria-expanded", "true");
    }
    isOpen = true;
    emit("open");
  }

  function close(fromFrame) {
    if (!frame) return;
    if (!fromFrame) send({ type: "close" });
    frame.style.display = "none";
    if (launcher && !hidden) {
      launcher.style.display = "flex";
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    }
    isOpen = false;
    emit("close");
  }

  function hide() {
    hidden = true;
    if (frame) frame.remove();
    if (launcher) launcher.remove();
    frame = null;
    launcher = null;
  }

  window.addEventListener("message", function (event) {
    if (!frame || event.origin !== origin || event.source !== frame.contentWindow) return;
    var msg = event.data;
    if (!msg || typeof msg !== "object" || msg.source !== "vnchat-embed" || msg.v !== 1) return;
    switch (msg.type) {
      case "ready":
        emit("ready");
        break;
      case "open":
        if (!isOpen) open();
        break;
      case "close":
        close(true);
        break;
      case "hide":
        hide();
        break;
      case "unread:change":
        if (typeof msg.count === "number" && badge) {
          badge.textContent = msg.count > 99 ? "99+" : String(msg.count);
          badge.style.display = msg.count > 0 ? "block" : "none";
        }
        emit("unread", msg.count);
        break;
      default:
        break;
    }
  });

  window.addEventListener("resize", layout);

  function init() {
    createLauncher();
  }
  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);

  // API cho trang host
  window.VNChat = {
    __loaded: true,
    open: open,
    close: function () {
      close(false);
    },
    setTheme: function (value) {
      theme = pick(value, ["light", "dark", "system"], theme);
      send({ type: "theme:set", theme: theme });
    },
    setLocale: function (value) {
      locale = pick(value, ["vi", "en"], locale);
      if (launcher) launcher.setAttribute("aria-label", labels[locale]);
      send({ type: "locale:set", locale: locale });
    },
    on: function (name, fn) {
      if (listeners[name] && typeof fn === "function") listeners[name].push(fn);
    },
  };
})();
