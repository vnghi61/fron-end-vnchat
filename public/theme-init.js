// Đọc lựa chọn theme đã lưu (system | light | dark) và đặt data-theme trước lần vẽ đầu.
// Đồng bộ với src/core/ui/theme.ts (cùng key "vnchat.theme").
(function () {
  var pref = "system";
  try {
    pref = localStorage.getItem("vnchat.theme") || "system";
  } catch (e) {}
  var dark = pref === "dark" || (pref !== "light" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
})();
