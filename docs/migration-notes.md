# Migration notes – VNChat Web 1.x → 2.0

Ghi chú cho người deploy và người bảo trì khi chuyển từ frontend cũ (React + Zustand store, API `/api/messages/*`) sang
2.0. Chi tiết hợp đồng từng màn: `docs/frontend-backend-contract-map.md`.

## 1. Thay đổi phá vỡ

| Hạng mục | 1.x | 2.0 |
| :--- | :--- | :--- |
| Route | `/`, `/login`, `/signup`, `/profile` | `/app/*` (đầy đủ), `/compact/*` (WebView/khung hẹp), `/support/*`, `/admin/*`, `/widget`, `/embed/*`; `/` → `/app` |
| Chat | `GET /api/messages/users`, `GET /api/messages/:id`, `POST /api/messages/send/:id`, event `newMessage` | `GET /api/conversations` (cursor), `POST /api/conversations/direct`, `GET/POST /api/conversations/:id/messages` (`clientMsgId`), event `message.new` … |
| Phiên | `GET /api/auth/check`, socket `query.userId`, `getOnlineUsers` | `GET /api/me/bootstrap`, socket JWT (cookie hoặc `auth.token`) + `ready`, `user.online/offline`, `GET /api/presence` |
| Hồ sơ | `PUT /api/auth/update-profile` | `PATCH /api/me` |
| Lỗi | hiện thẳng `message` tiếng Anh | map `code` (`CHAT-xxx-yyy`) → i18n vi/en; `fields[]` gắn vào ô form |
| Mất kết nối | không khôi phục | `GET /api/sync?since=` sau `ready` và khi quay lại tab |

Màn legacy `/app/legacy` (chat 1-1 trên API cũ, giữ tạm từ Phase 1) **đã gỡ ở Phase 7** sau khi `e2e/chat.spec.ts`
xác nhận chat 1-1 trên Conversations tương đương (danh bạ → mở chat, gửi/nhận realtime, chưa đọc, đang nhập, đã xem,
trực tuyến, gửi lại idempotent, khôi phục khi mất kết nối, phân trang). Frontend không còn gọi `/api/messages/users`,
`/api/messages/:id`, `/api/messages/send/:id` và không nghe `newMessage`/`getOnlineUsers`. (`/api/messages/search` là
API tìm kiếm **mới**, vẫn dùng.) Backend có thể giữ các route cũ cho client khác; khi gỡ phía backend, không cần đổi
frontend.

## 2. Biến môi trường

| 1.x | 2.0 |
| :--- | :--- |
| `VITE_API_URL` (hoặc hard-code `localhost:5001`) | `VITE_API_URL` (rỗng = cùng origin), `VITE_DEV_API_TARGET` (proxy dev) |
| – | `VITE_AUTH_TRANSPORT=cookie|bearer` |
| – | `VITE_EMBED_PARENT_ORIGINS` + header `frame-ancestors` (`deploy/`) |

## 3. Dữ liệu trên trình duyệt

- 2.0 không đọc storage của 1.x. Khoá mới: `vnchat.auth.token` (bearer standalone), `vnchat.embed.token` (iframe),
  `vnchat.widget.token` + `vnchat.widget.visitor` (widget, kèm `vnchat.widget.open` trong sessionStorage), `vnchat.theme`, `vnchat.locale`.
- Người dùng đăng nhập bằng cookie không phải đăng nhập lại khi chuyển phiên bản (cookie `jwt` do backend quản lý).

## 4. Trình tự chuyển đổi đề xuất

1. Backend bản có Conversations + bootstrap + sync (nhánh `feature/chat-platform-features`) chạy trước.
2. Deploy web 2.0 lên staging, chạy `e2e` + kiểm tay theo `docs/release-checklist.md`.
3. Cập nhật link nhúng/widget ở site đối tác sang `vnchat-widget.js` hoặc `<iframe src=…/embed>` (mẫu `examples/host`).
4. Deploy production; giữ bản 1.x để rollback tới khi smoke test xong.
