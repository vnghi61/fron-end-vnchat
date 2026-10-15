# E2E (Playwright, backend thật)

Bộ kiểm thử chạy giao diện thật với backend thật – **không mock API**. Đây cũng là bài kiểm "tương đương" dùng để gỡ
màn legacy `/api/messages/*` (contract map §7).

## Chuẩn bị (một lần)

1. Backend: trong `back-end-vnchat` chạy `docker compose up -d --build` (API `:5001` + MongoDB).
2. Tạo 3 tài khoản QA (đăng ký ở `/signup` hoặc `POST /api/auth/signup`) rồi gán vai trò:

   ```bash
   docker exec vnchat-api-1 node src/scripts/set-roles.js binh.qa@vnchat.test admin,member
   docker exec vnchat-api-1 node src/scripts/set-roles.js cuong.qa@vnchat.test agent,member
   docker exec vnchat-api-1 node src/scripts/set-roles.js dung.qa@vnchat.test agent,member
   ```

3. `cp .env.e2e.example .env.e2e` và điền `QA_PASSWORD` (file bị gitignore; không commit, không dán vào issue/MR).
4. Trình duyệt: `npx playwright install chromium webkit firefox` – chạy **trong repo** để tải đúng bản khớp
   `@playwright/test` của project (CLI toàn cục/bản khác tải build khác, project không dùng được).

## Chạy

| Lệnh                                                                      | Phạm vi                                                                                                        |
| :------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------- |
| `npm run e2e`                                                             | Chromium desktop – toàn bộ test                                                                                |
| `npm run e2e:matrix`                                                      | Chromium + Chrome mobile (Pixel 7) + Firefox, rồi `e2e:webkit`: các test gắn `@cross` / `@mobile`             |
| `npm run e2e:webkit`                                                      | Safari/iOS: WebKit desktop + iPhone 14 (xem lưu ý cookie bên dưới)                                             |
| `npx playwright test e2e/chat.spec.ts --project=setup --project=chromium` | một file                                                                                                       |
| `E2E_SERVER=preview npm run e2e`                                          | trên **bản build production** (`vite build` trước; `vite preview` proxy `/api` như dev)                        |
| `E2E_SERVER=none E2E_BASE_URL=https://staging… E2E_API_URL=… npm run e2e` | staging đã deploy (không tự chạy server)                                                                       |
| `npm run e2e:report`                                                      | mở báo cáo HTML (trace, ảnh lỗi, báo cáo axe đính kèm)                                                         |

**WebKit và cookie trên http://localhost**: backend Docker (chế độ production) đặt cookie `jwt` với `Secure`; Chromium/Firefox
coi localhost là ngữ cảnh an toàn nên vẫn gửi, WebKit thì không. Vì vậy khi lệnh chạy WebKit/Safari trên server local qua http,
config tự cho dev server dùng `VITE_AUTH_TRANSPORT=bearer` (đường site khác / iframe) và không dùng lại server đang chạy;
staging HTTPS chạy cookie bình thường. Ghi đè bằng `E2E_AUTH_TRANSPORT=cookie|bearer`.

Playwright tự chạy `npm run dev` (kèm `VITE_EMBED_PARENT_ORIGINS=<E2E_HOST_URL>`) và trang host
`examples/host/serve.mjs`, hoặc dùng lại server đang chạy. Nếu dev server đã chạy **không** có origin trang host trong
allowlist thì test nhúng fail – thêm vào `.env.development.local`.

## Bao phủ

| File                 | Nội dung                                                                                                                                                                                                                                  |
| :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.setup.ts`      | kiểm môi trường, đăng nhập 3 tài khoản một lần, lưu phiên vào `e2e/.auth/` (gitignore)                                                                                                                                                    |
| `auth.spec.ts`       | sai mật khẩu, `?next=` + đăng xuất, chặn open redirect, kiểm tra form đăng ký phía client                                                                                                                                                 |
| `chat.spec.ts`       | chat 1-1: mở từ danh bạ, realtime, chưa đọc, đang nhập, đã xem, trực tuyến; gửi lại cùng `clientMsgId` (mất request / mất phản hồi) → một bong bóng; mất socket → `/api/sync` khôi phục đúng một lần; phân trang lịch sử giữ thứ tự `seq` |
| `messages.spec.ts`   | nhóm: trả lời, cảm xúc, sửa, ghim, chuyển tiếp, xoá; bình chọn realtime; nhắc việc; tìm tin không dấu + tìm người                                                                                                                         |
| `support.spec.ts`    | widget khách ↔ 2 nhân viên: xem chỉ đọc, tranh nhận (409-006), chuyển người, trả hàng đợi, đóng, đánh giá                                                                                                                                 |
| `admin.spec.ts`      | console quản trị: chặn tự khoá phân quyền, secret webhook / API key hiện một lần, nhật ký; agent bị chặn `/admin`                                                                                                                         |
| `embed.spec.ts`      | CSP theo route, loader widget trên site khác, phiên khách không cookie, badge chưa đọc, message giả bị bỏ, `/embed` đăng nhập trong khung + lệnh host + `FrameGuard`, site ngoài allowlist bị chặn, bridge WebView native                 |
| `a11y.spec.ts`       | axe WCAG 2.1 AA trên 11 màn × sáng/tối (serious/critical = fail), bàn phím, bẫy focus dialog, giảm chuyển động                                                                                                                            |
| `responsive.spec.ts` | điện thoại: một pane, chat toàn màn, back đóng sheet trước, không cuộn ngang                                                                                                                                                              |
| `visual.spec.ts`     | ảnh chuẩn màn tĩnh (đăng nhập, form widget, đăng nhập nhúng) – baseline Chromium/Windows                                                                                                                                                  |

## Quy ước

- Dữ liệu mỗi lần chạy có hậu tố ngẫu nhiên (`stamp()`); test chỉ làm thao tác tự dọn được (đóng yêu cầu hỗ trợ, xoá
  webhook, thu hồi API key) và **không** đổi vai trò, khoá tài khoản QA hay cài đặt hệ thống dùng chung.
- Chạy tuần tự (`workers: 1`): backend dùng chung, hàng đợi hỗ trợ và rate limit (đăng nhập 20/phút/IP, tin 60/phút);
  helper tự chờ `Retry-After` khi gặp 429.
- Lỗi console/pageerror ngoài danh sách cho phép (`fixtures.ts`) làm test fail.
- Không sửa file trong repo khi E2E đang chạy: dev server reload trang và làm hỏng lượt chạy.
- Safari thật trên iOS và Android WebView thật không chạy được trong Playwright – kiểm tay theo
  `docs/release-checklist.md` (WebKit trong Playwright là xấp xỉ gần nhất cho Safari/iOS).
