// Nhãn thiết bị gửi kèm login (`device`) để màn "Thiết bị đăng nhập" dễ đọc. Chỉ là nhãn hiển thị.
export function describeDevice(ua: string = navigator.userAgent): string {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Trình duyệt";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const webview = /; wv\)/.test(ua) || /VNChatApp/.test(ua) ? " (WebView)" : "";
  return `${browser}${os ? ` · ${os}` : ""}${webview}`.slice(0, 100);
}
