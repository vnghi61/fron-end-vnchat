# Changelog

## [Unreleased] – VNChat 2.0

### Phase 3 – Messaging advanced
- Thông tin hội thoại (màn 09/10): cột phải ở pane ≥ 1200px, Sheet ở màn hẹp (`?panel=details`, nút back đóng panel
  trước). Thành viên + online, đổi vai trò (owner), chuyển trưởng nhóm, thêm/xoá thành viên, sửa tên/ảnh/quyền xem lịch
  sử, rời nhóm (gợi ý chuyển quyền khi `CHAT-409-002`), tin đã ghim, thư viện ảnh/video/âm thanh/tệp/liên kết, tìm trong
  hội thoại.
- Nhảy tới tin (`?msg=&seq=`): tải lùi tối đa 12 trang rồi cuộn giữa + làm nổi bật; quá cũ → thông báo (B6).
- Bình chọn: tạo từ menu "+" (2..`limits.pollMaxOptions` phương án, chọn nhiều, ẩn danh, tự đóng), thẻ trong feed bỏ
  phiếu / đổi phiếu / rút phiếu / kết thúc (người tạo, owner/admin), số đếm realtime `poll.updated/closed`.
- Nhắc việc: "Nhắc tôi" trên tin (giờ nhanh, múi giờ máy, ISO có offset), trang Nhắc việc (sắp tới / đã nhắc / đã huỷ,
  sửa, huỷ), `reminder.*` realtime, toast khi đến hạn kèm "Mở tin nhắn" (không có push – B13).
- Ô soạn: emoji, sticker (`GET /api/stickers`), gợi ý `@thành viên` → `mentions[]`, gợi ý `/lệnh` từ `commandRules`,
  tệp qua chữ ký Cloudinary (chọn / dán / kéo thả, ≤ 10 tệp, tiến trình, tải lại, chỉ gửi khi mọi tệp xong) – chỉ hiện
  khi `features.uploads` (B10).
- Tìm kiếm toàn cục (tin nhắn + người, lọc loại/ngày, `q` trên URL), Danh bạ, hồ sơ người dùng dạng Sheet (nhắn tin,
  biệt danh riêng, chặn/bỏ chặn), Cài đặt › Thiết bị đăng nhập (thu hồi, đăng xuất mọi nơi) và Danh sách chặn.
- Điều hướng thêm Tìm kiếm · Danh bạ · Nhắc việc (bottom nav ≤ 5 mục).
- Kiểm thử: unit (gợi ý, nhắc việc, upload, thẻ bình chọn, nav, initials) + kịch bản 2 người dùng với backend thật
  (nhóm, vai trò, bình chọn realtime, mention, ghim → nhảy tin, tìm, nhắc việc, biệt danh, cài đặt, sheet trên mobile).

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
