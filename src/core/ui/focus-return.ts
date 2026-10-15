import { useCallback, useRef } from "react";

// Radix Dialog/AlertDialog ở chế độ modal chặn việc trả focus mặc định và chỉ focus lại `Dialog.Trigger`. Dialog mở bằng
// state (nút thường, mục menu "Chuyển tiếp", "Nhắc tôi"…) không có Trigger → đóng xong focus rơi về <body>: người dùng
// bàn phím/trình đọc màn hình mất vị trí (WCAG 2.4.3). Ghi lại phần tử mở dialog và trả focus về đó.

const MENU = '[role="menu"],[role="listbox"]';

/** Vài phần tử được focus gần nhất (ngoài menu) – ô `autoFocus` trong dialog nhận focus trước khi dialog gắn ref. */
const history: HTMLElement[] = [];
if (typeof document !== "undefined")
  document.addEventListener(
    "focus", // capture: "focus" không nổi bọt nhưng vẫn bắt được ở document
    (e) => {
      if (!(e.target instanceof HTMLElement) || e.target === document.body || e.target.closest(MENU)) return;
      history.push(e.target);
      if (history.length > 10) history.shift();
    },
    true,
  );

/** Phần tử còn trong trang, ngoài dialog, được focus gần nhất. */
function recentOutside(container: Element | null): HTMLElement | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const el = history[i]!;
    if (el.isConnected && !container?.contains(el)) return el;
  }
  return null;
}

/**
 * Phần tử mở dialog `container`: phần tử đang focus nếu nằm ngoài dialog; mục menu (biến mất khi chọn) → nút đã mở menu,
 * Radix gắn qua `aria-labelledby` (bấm chuột vào nút mở menu không làm nút nhận focus nên không có trong lịch sử).
 */
function openerOf(active: Element | null, container: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === document.body || container?.contains(active)) return null;
  const menu = active.closest<HTMLElement>(MENU);
  if (!menu) return active;
  return document.getElementById(menu.getAttribute("aria-labelledby") ?? "") ?? recentOutside(container);
}

/** Truyền `ref` và `onCloseAutoFocus` vào Radix Dialog.Content / AlertDialog.Content. */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  // Ghi nhận lúc khung dialog gắn vào DOM (không dùng onOpenAutoFocus: Radix KHÔNG phát nó khi trong dialog đã có ô
  // `autoFocus` được focus sẵn). Ref ổn định → chỉ gọi khi mount/unmount; giữ giá trị khi unmount để dùng lúc đóng.
  const ref = useCallback((node: HTMLElement | null) => {
    if (node) opener.current = openerOf(document.activeElement, node) ?? recentOutside(node);
  }, []);
  return {
    ref,
    onCloseAutoFocus: (event: Event) => {
      const el = opener.current ?? recentOutside(event.currentTarget as Element | null);
      opener.current = null;
      if (!el?.isConnected) return; // để Radix tự xử lý (Trigger nếu có)
      event.preventDefault();
      el.focus();
    },
  };
}
