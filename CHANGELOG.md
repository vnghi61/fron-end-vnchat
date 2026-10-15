# Changelog

## [Unreleased] – VNChat 2.0

### Phase 4 – Business support
- Widget khách `/widget` (màn 15): launcher ↔ panel (lấp đầy iframe khi được nhúng), form tên/email/câu hỏi, giữ danh
  tính bằng `visitorToken` và tự lấy phiên mới khi token hết hạn, lịch sử yêu cầu, "Hỗ trợ trực tuyến không khả dụng"
  khi `CHAT-403-001`. Transport cách ly: Bearer token riêng + fetch `credentials: "omit"` để phiên khách không ghi đè
  cookie thành viên (B15).
- Yêu cầu hỗ trợ phía khách (màn 16), dùng chung app thành viên và widget: chờ nhân viên → "<tên> đang hỗ trợ bạn" →
  kết thúc (xác nhận) → đánh giá 1–5 sao + góp ý (radiogroup, phím mũi tên) → bắt đầu cuộc mới; ô soạn khoá khi đã
  đóng. Thành viên mở yêu cầu từ menu tài khoản ("Liên hệ hỗ trợ").
- Console hỗ trợ `/support` (màn 17/18, chỉ khi `permissions.agent`): thống kê, hàng đợi Chờ nhận / Của tôi / Đang xử lý
  / Đã đóng / Tất cả + lọc tag (giữ trên URL), xem chỉ đọc yêu cầu chưa nhận qua `support:watch` (đăng ký lại sau mỗi
  lần socket `ready`), nhận / chuyển / trả về hàng đợi / đóng / mở lại / gán hộ (admin), tag, chi tiết khách + thông
  tin trang + mốc thời gian + đánh giá. Nhận trùng → `CHAT-409-006`: thông báo và tải lại trạng thái thật.
- Realtime `support.updated` (room conv và room agents – chỉ merge field dùng chung, B2) và `support.message` cập nhật
  inbox, chi tiết và mọi tab hàng đợi; thống kê làm mới có debounce.
- Tin hệ thống tra tên người đã rời hội thoại (`GET /api/users/:id`), khách widget dùng câu chung (B16).
- Kiểm thử: unit (hàng đợi, router event support, transport cách ly, banner, đánh giá, câu hệ thống) + kịch bản thật
  khách ↔ 2 nhân viên (xem chỉ đọc, nhận trùng 409, tag, chuyển, trả, đóng, đánh giá, cuộc mới, phiên thành viên
  không bị đá, thành viên mở yêu cầu, console một cột trên mobile).

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
