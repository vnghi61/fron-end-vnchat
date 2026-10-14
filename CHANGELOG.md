# Changelog

## [Unreleased] – VNChat 2.0

### Phase 2 – Messaging core
- Inbox theo `GET /api/conversations` (cursor, ảo hoá TanStack Virtual): mục "Đã ghim" (`?pinned=true`), lọc Cá nhân/Nhóm/
  Hỗ trợ/Lưu trữ, preview bản địa hoá, unread, tắt thông báo/ghim/lưu trữ (nút "…", chuột phải, nhấn giữ).
- Chat 1-1 (`POST /api/conversations/direct`) và tạo nhóm (`POST /api/conversations/group`, quyền xem lịch sử).
- Feed tin ảo hoá neo cuối (`anchorTo: end`): tải tin cũ `?before=` giữ vị trí, dính cuối khi resize/bàn phím ảo,
  nút "N tin nhắn mới", vạch "Tin nhắn mới", phân ngày, gộp cụm, đủ 6 type + đã xoá/sửa/trả lời/chuyển tiếp/ghim.
- Gửi optimistic qua outbox với `clientMsgId` (UUID), thử lại cùng id, dedup theo `_id`/`clientMsgId`.
- Thao tác tin: trả lời, cảm xúc (lạc quan), sửa, xoá (xác nhận), ghim/bỏ ghim, ẩn với tôi (hoàn tác), chuyển tiếp ≤ N.
- Event router tập trung (message.*, reaction, pin, hidden, read.updated, conversation.*, member.*) – payload viewer
  null chỉ merge field dùng chung (B2); typing (store riêng, hết hạn theo `expiresAt`), presence + "Hoạt động x phút trước",
  "Đã xem" (direct) / avatar người đã xem (nhóm), đánh dấu đã đọc khi ở cuối feed, tổng chưa đọc trên nav.
- Kết nối lại / quay lại foreground → `GET /api/sync` (fallback làm mới khi `hasMore` – B1), banner trạng thái kết nối.
- Sửa: `emit` Socket.IO mất `this` (typing không gửi được) – phát hiện khi chạy kịch bản 2 người dùng thật.

### Phase 1 – Foundation
- TypeScript strict (Vite 6, React 19), alias `@/`, Vitest + Testing Library + MSW, ESLint typescript-eslint, Prettier.
- Kiểu contract sinh từ `api/openapi.yaml` của backend (`npm run gen:api`) + kiểu domain chặt có kiểm tra compile-time
  (`contract-check.ts`) – không field nào ngoài OpenAPI.
- Design token CSS (sáng/tối/hệ thống, indigo, Be Vietnam Pro self-host), branding `primaryColor` có kiểm tra tương phản.
- i18next (vi mặc định, en), thông báo lỗi theo `code` backend; Sonner là thư viện toast duy nhất.
- Phiên từ `GET /api/me/bootstrap` (quyền, branding, features, limits); cookie hoặc Bearer (`VITE_AUTH_TRANSPORT`).
- Socket.IO xác thực JWT (bỏ `query.userId`), trạng thái chỉ "đã kết nối" sau `ready`; `session.revoked`, `block.updated`,
  `nickname.updated`.
- Shell `/app` và `/compact` responsive theo **container** (rail ≥ 900px, bottom nav khi hẹp), guard đăng nhập/quyền.
- Màn Đăng nhập, Đăng ký (RHF + Zod), Cài đặt hồ sơ (`PATCH /api/me`) và giao diện (theme, ngôn ngữ).
- Gỡ DaisyUI, react-hot-toast; màn chat cũ (API Legacy) giữ tạm ở `/app` cho tới Phase 2.

### Phase 0 – Audit
- `docs/ui-vnchat-2-design-system.md`, `docs/frontend-backend-contract-map.md`, `docs/embed-webview-architecture.md`.
