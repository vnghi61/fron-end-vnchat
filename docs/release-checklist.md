# Release checklist & runbook – VNChat Web 2.0

Áp dụng cho mỗi lần phát hành frontend (static). Backend phát hành riêng (repo `back-end-vnchat`); frontend chỉ phụ thuộc
hợp đồng API/socket đã ghi trong `docs/frontend-backend-contract-map.md`.

## 1. Trước khi tạo bản phát hành

- [ ] Nhánh đã rebase/merge từ nhánh chính, CI xanh.
- [ ] `npm run check` xanh: typecheck, lint, unit test (Vitest), `vite build`, `scripts/check-bundle.mjs`
      (ngân sách gzip: JS ban đầu ≤ 270 KB, chunk lớn nhất ≤ 165 KB, `vnchat-widget.js` ≤ 4 KB; quét bí mật trong `dist/`).
- [ ] `npm run e2e` xanh trên backend local cùng phiên bản với backend sẽ chạy cùng (xem `e2e/README.md`).
- [ ] `E2E_SERVER=preview npm run e2e` xanh – chạy trên **bản build production**, không phải dev server.
- [ ] `npm run e2e:matrix` xanh (Chrome mobile, WebKit desktop + iPhone, Firefox cho test `@cross` / `@mobile`).
- [ ] Ảnh visual (`e2e/visual.spec.ts-snapshots/`) chỉ đổi khi có thay đổi giao diện có chủ đích – đính kèm ảnh trong MR.
- [ ] `CHANGELOG.md` cập nhật; mục blocker mới (nếu có) ghi vào contract map §6.
- [ ] Không có tính năng chưa có hợp đồng backend hiển thị như đang chạy (gọi thoại/video, push, SSO, upload resume,
      tenant admin, quản lý task ngoài `/task`).

## 2. Cấu hình môi trường (biến build – công khai)

| Biến | Production | Ghi chú |
| :--- | :--- | :--- |
| `VITE_API_URL` | origin API (vd. `https://api.vnchat.vn`) hoặc rỗng nếu reverse proxy cùng origin | |
| `VITE_AUTH_TRANSPORT` | `cookie` nếu web và API **cùng site**; `bearer` nếu khác site | iframe/widget luôn dùng Bearer |
| `VITE_EMBED_PARENT_ORIGINS` | danh sách origin đối tác, phân tách dấu phẩy | phải **khớp** header `frame-ancestors` |

Không có secret nào ở frontend. Backend phải cho phép CORS từ origin web (`CLIENT_URL`) và đặt `COOKIE_SAMESITE`
phù hợp nếu dùng cookie.

## 3. Phát hành staging

1. Build với biến staging, deploy lên static host staging (`deploy/README.md`: nginx hoặc Render).
2. Kiểm header:
   ```bash
   curl -sI https://staging-chat.example.vn/embed | grep -i content-security-policy
   curl -sI https://staging-chat.example.vn/app | grep -i content-security-policy
   ```
   `/embed`, `/widget` liệt kê origin đối tác; mọi route khác chỉ `frame-ancestors 'self'`.
3. E2E trên staging (tài khoản QA của staging, không dùng tài khoản người dùng thật):
   ```bash
   E2E_SERVER=none E2E_BASE_URL=https://staging-chat.example.vn E2E_API_URL=https://staging-api.example.vn \
   E2E_HOST_URL=https://<trang host thử nghiệm trong allowlist> npm run e2e
   ```
4. Kiểm tay trên thiết bị thật (Playwright không thay được):

| Môi trường | Kịch bản |
| :--- | :--- |
| iOS Safari (iPhone thật) | đăng nhập, chat, bàn phím ảo không che ô soạn, safe-area tai thỏ/home indicator, widget trên site đối tác (ITP chặn cookie bên thứ ba → Bearer vẫn chạy) |
| Android Chrome | như trên + nút back cứng đóng sheet trước khi rời màn |
| Android WebView (app host) | `/compact` hoặc `/embed` trong WebView: chọn tệp (`onShowFileChooser`), link ngoài qua `navigate:external`, back, xoay màn |
| iOS WKWebView (app host) | bridge `webkit.messageHandlers.vnchat`, chọn ảnh/tệp, quay lại từ nền → tự đồng bộ |
| Safari macOS + Firefox | nhúng `/embed` trên site đối tác với chặn cookie bên thứ ba bật |

## 4. Phát hành production

1. Tag phiên bản (`vX.Y.Z`), build với biến production, deploy.
2. Smoke test ngay sau deploy (5 phút): đăng nhập, mở chat 1-1, gửi/nhận giữa 2 tài khoản QA production, widget trên
   một trang đối tác trong allowlist, `/support` với tài khoản agent, `/admin` với tài khoản admin.
3. Theo dõi 30 phút: tỉ lệ lỗi API 4xx/5xx từ web (log backend), lỗi socket handshake, phản hồi người dùng.

## 5. Rollback

- Static host giữ các bản deploy trước: Render → *Rollback* về deploy trước; nginx → trỏ lại thư mục/symlink build cũ.
  Không cần đụng backend vì frontend không đổi dữ liệu.
- Đổi allowlist nhúng cần **build lại** (biến build) **và** đổi header – rollback cả hai cùng lúc.
- Sau rollback: chạy lại smoke test §4.2, ghi nguyên nhân vào issue phát hành.

## 6. Sau phát hành

- [ ] Cập nhật `CHANGELOG.md` (chuyển mục Unreleased thành phiên bản).
- [ ] Đóng các blocker đã được backend xử lý trong contract map §6 (nếu có).
