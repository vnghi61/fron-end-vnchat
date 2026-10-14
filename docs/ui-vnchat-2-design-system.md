# VNChat 2.0 – Design System

> Nguồn quyết định: spec `VNCHAT-UI-UX-WEBVIEW-IMPLEMENTATION.md` §3 (bắt buộc) + kết quả skill **ui-ux-pro-max**
> (`--design-system "team messaging chat app realtime" --variance 4 --motion 3 --density 6`, các truy vấn bổ sung
> `typography`, `google-fonts`, `ux`, `--stack react`, `--stack shadcn`). Khi skill và spec khác nhau, **spec thắng**;
> bảng §1 ghi rõ chỗ nào lấy từ đâu. Token thật nằm ở `src/core/ui/styles/tokens.css` – tài liệu này phải khớp file đó.

## 1. Định hướng

| Hạng mục | Quyết định | Nguồn |
| :--- | :--- | :--- |
| Phong cách | **Minimalism & Swiss** – sạch, lưới rõ, tương phản cao, ít trang trí, không gradient nặng, không glassmorphism | skill (`style`), khớp spec "product-oriented, clean" |
| Màu nhấn | **Indigo** `#5865F2` (sáng) / `#8791FF` (tối) | spec §3.1 – skill đề xuất xanh `#2563EB`, **không dùng** |
| Font | **Be Vietnam Pro** (một family cho cả heading/body) + fallback hệ thống | skill `typography` → cặp "Vietnamese Friendly" (Be Vietnam Pro + Noto Sans); spec cho phép Inter hoặc Be Vietnam Pro. Skill `--design-system` đề xuất Poppins/Open Sans – **bỏ** vì Poppins thiếu dấu tiếng Việt chuẩn |
| Pattern landing | Không áp dụng (đây là app, không phải landing) | skill trả "Product Demo + Features" – bỏ qua |
| Motion | Subtle (dial 3): micro-interaction 100–160 ms, drawer/modal 180–240 ms, không scroll-reveal trong app | spec §3.3; snippet GSAP của skill **không dùng** (không thêm GSAP) |
| Mật độ | `comfortable` mặc định; `compact` cho console hỗ trợ / admin | spec §3.1, dial density 6 |
| Icon | `lucide-react` duy nhất, stroke 2, không emoji làm icon cấu trúc (emoji chỉ là *nội dung*: reaction, sticker) | skill pro-rules + spec |
| Component base | shadcn-style (Radix primitives qua gói `radix-ui`, `class-variance-authority`, `tailwind-merge`) copy vào `src/core/ui/components` | spec §2.2; DaisyUI bị gỡ ở Phase 1 |

Font được self-host bằng `@fontsource/be-vietnam-pro` (subset `vietnamese` + `latin`), không gọi Google Fonts lúc chạy:
không phụ thuộc mạng ngoài trong iframe/WebView và không cần nới CSP `font-src`.

## 2. Token màu (semantic)

Component **chỉ** dùng token (`bg-surface`, `text-muted-foreground`, `border-border`…), không hex, không `bg-blue-500`.
Tỉ lệ tương phản đo bằng công thức WCAG 2.x (script trong lịch sử commit Phase 0).

### 2.1 Sáng (`:root`, `[data-theme="light"]`)

| Token | Giá trị | Dùng cho | Tương phản |
| :--- | :--- | :--- | :--- |
| `--background` | `#F6F7FB` | nền app | – |
| `--surface` | `#FFFFFF` | panel, card, bong bóng người khác | – |
| `--surface-raised` | `#FFFFFF` + `--shadow-md` | popover, menu, dialog | – |
| `--muted` | `#EEF0F6` | hover, ô nhập, chip | – |
| `--foreground` | `#0F172A` | chữ chính | 17.85 trên surface |
| `--muted-foreground` | `#5B6478` | chữ phụ, timestamp | 5.93 / surface, 5.21 / muted |
| `--border` | `#E3E6EE` | đường kẻ trang trí | (trang trí – không mang nghĩa) |
| `--input` | `#8B93A7` | viền ô nhập, checkbox | 3.07 (non-text ≥ 3:1) |
| `--primary` | `#5865F2` | nút chính, link, focus | 4.61 với chữ trắng |
| `--primary-foreground` | `#FFFFFF` | chữ trên primary | 4.61 |
| `--primary-hover` | `#4752C4` | hover/pressed | 6.42 với chữ trắng |
| `--primary-soft` | `#EEF0FE` | mục đang chọn | chữ `--primary-strong` 5.66 |
| `--primary-strong` | `#4752C4` | chữ nhấn trên nền nhạt | 6.42 / surface |
| `--success` | `#15803D` | online, thành công | 5.02 với chữ trắng |
| `--warning` | `#B45309` | cảnh báo, chờ nhân viên | 5.02 |
| `--danger` | `#DC2626` | xoá, lỗi | 4.83 |
| `--focus-ring` | `#5865F2` | vòng focus 2px + offset 2px | 4.30 / background |
| `--bubble-mine` / `-foreground` | `#5865F2` / `#FFFFFF` | bong bóng của tôi | 4.61 |
| `--bubble-other` / `-foreground` | `#FFFFFF` / `#0F172A` | bong bóng người khác (có viền `--border`) | 17.85 |

### 2.2 Tối (`[data-theme="dark"]`, hoặc `system` + `prefers-color-scheme: dark`)

| Token | Giá trị | Tương phản |
| :--- | :--- | :--- |
| `--background` | `#0F1117` | – |
| `--surface` | `#161922` | – |
| `--surface-raised` | `#1D212C` | – |
| `--muted` | `#232837` | – |
| `--foreground` | `#E8EAF0` | 15.69 / background, 12.21 / muted |
| `--muted-foreground` | `#A3ABBD` | 8.19 / background, 6.38 / muted |
| `--border` | `#2A2F3D` | trang trí |
| `--input` | `#6B7389` | 3.71 / surface |
| `--primary` / `--primary-foreground` | `#8791FF` / `#0B0D1A` | 6.92 |
| `--primary-hover` | `#A5ADFF` | – |
| `--primary-soft` / `--primary-strong` | `#232A5C` / `#C7CCFF` | 8.68 |
| `--success` / `--warning` / `--danger` | `#4ADE80` / `#FBBF24` / `#F87171` (dùng làm chữ/viền trên nền tối) | 10.07 / 10.52 / 6.35 trên surface |
| `--bubble-mine` / `-foreground` | `#4752C4` / `#FFFFFF` (dịu hơn primary để không chói trong tối) | 6.42 |
| `--bubble-other` / `-foreground` | `#1D212C` / `#E8EAF0` | – |

Dark mode được kiểm riêng, không suy từ bản sáng (pro-rules: *Checked dark mode contrast independently*).

### 2.3 Branding từ backend

`GET /api/me/bootstrap` → `branding: { appName, logoUrl, primaryColor }` (mặc định `primaryColor: ""`).
`applyBranding()` (`src/core/ui/branding.ts`):

1. Rỗng / không phải hex `#RGB`/`#RRGGBB` → giữ indigo mặc định.
2. Chọn chữ trên nút: trắng nếu tương phản ≥ 4.5, nếu không thì `#0B0D1A` nếu ≥ 4.5; cả hai đều trượt → **bỏ** màu brand.
3. Màu brand dùng làm chữ/link trên `--surface` phải ≥ 4.5; không đạt → làm tối (sáng) / sáng (tối) dần tới khi đạt, tối đa
   10 bước, không đạt thì chỉ dùng cho nền nút.
4. Chỉ ghi đè `--primary`, `--primary-foreground`, `--primary-hover`, `--focus-ring`, `--bubble-mine*` – không đụng surface.

Có unit test cho cả ba nhánh. Không có endpoint branding công khai cho khách widget (xem contract map §6).

## 3. Typography

| Token | Cỡ / line-height | Dùng cho |
| :--- | :--- | :--- |
| `text-xs` | 12 / 16 | badge, meta – **không** dùng cho nội dung đọc |
| `text-sm` | 14 / 20 | chữ phụ, menu, item inbox |
| `text-base` | 16 / 24 | nội dung tin nhắn, ô nhập (16px tránh iOS tự zoom) |
| `text-lg` | 18 / 28 | tiêu đề panel |
| `text-xl` | 20 / 28 | tiêu đề trang |
| `text-2xl` | 24 / 32 | màn đăng nhập |

Weight: 400 nội dung, 500 tên/label, 600 tiêu đề. `font-feature-settings: "tnum"` cho số liệu (thống kê, giờ).
Tin nhắn giữ xuống dòng (`white-space: pre-wrap`, `overflow-wrap: anywhere`).

## 4. Không gian, bo góc, đổ bóng, lớp

- **Spacing** hệ 4px: 4 / 8 / 12 / 16 / 20 / 24 / 32 (Tailwind `1 2 3 4 5 6 8`). `compact` giảm padding dòng từ 12 → 8.
- **Radius**: `--radius-sm 8px` (input, chip) · `--radius-md 12px` (card, menu) · `--radius-lg 16px` (dialog, bubble) ·
  `--radius-xl 24px` (sheet mobile, widget). Bubble: góc phía người gửi giảm còn 6px khi là tin liên tiếp trong cụm.
- **Shadow**: `--shadow-sm` (card), `--shadow-md` (popover/menu), `--shadow-lg` (dialog, widget panel). Tối dùng viền
  `--border` + shadow nhẹ hơn.
- **z-index**: base 0 · sticky 10 · drawer 40 · overlay 50 · toast 60 · widget launcher 70 (chỉ trong loader host).
- **Icon size**: 16 (inline), 20 (nút), 24 (nav). Nút icon có vùng chạm ≥ 44×44 trên thiết bị cảm ứng
  (`@media (pointer: coarse)`), 36×36 trên chuột.

## 5. Motion

| Token | Giá trị | Dùng cho |
| :--- | :--- | :--- |
| `--duration-fast` | 120ms | hover, pressed, đổi màu |
| `--duration-base` | 180ms | popover, tooltip, toast |
| `--duration-slow` | 240ms | drawer, sheet, dialog |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | vào |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | ra (ra nhanh hơn vào) |

- Chỉ animate `opacity`/`transform`, không animate width/height.
- Không animation khi thêm tin vào danh sách dài; optimistic bubble chỉ đổi opacity trạng thái gửi.
- `prefers-reduced-motion: reduce` → mọi duration = 0.01ms, bỏ spinner xoay thay bằng chấm tĩnh "…".
- Widget không có animation lặp vô hạn (không bounce launcher).

## 6. Responsive theo container

Ngưỡng đo trên **container của shell** (ResizeObserver `useContainerSize`), không phải viewport – iframe 500px trên màn
hình 1920px vẫn ra layout hẹp:

| Kích thước container | Layout |
| :--- | :--- |
| `< 480` (small) | một pane; bottom nav (Chat · Danh bạ · Cài đặt); header back |
| `480–899` (medium) | một pane tại một thời điểm (inbox *hoặc* chat), nav rút gọn, drawer full-height |
| `900–1199` (large) | rail trái + inbox ~280px + chat; panel chi tiết là drawer overlay |
| `≥ 1200` (xlarge) | rail + inbox 320–360px + chat + panel chi tiết 300–340px (bật/tắt) |

Component dùng container query Tailwind 4 (`@container` + biến `--container-pane-*`) cho chi tiết mật độ.
Admin/Agent **không** vào bottom nav của thành viên; là module riêng có guard quyền.

Safe-area: `viewport-fit=cover`, padding `env(safe-area-inset-*)` cho header/bottom nav/composer. Chiều cao app dùng
`--app-height` = `visualViewport.height` (fallback `100dvh`) để composer không bị bàn phím ảo che.

## 7. Theme

`system` (mặc định) · `light` · `dark`, lưu `localStorage["vnchat.theme"]` (đọc/ghi trong `try/catch` – iframe có thể chặn
storage). Áp bằng `data-theme` trên `<html>` trước khi React mount (script inline nhỏ trong `index.html` tránh nháy).
Host nhúng có thể ép theme qua bridge `theme:set` (xem embed doc).

## 8. Component contract

Mọi component tách **adapter dữ liệu** (hook trong `features/*/api` hoặc `hooks`) khỏi phần hiển thị, và có đủ trạng thái:

| Trạng thái | Quy ước |
| :--- | :--- |
| loading | skeleton đúng hình dạng nội dung (giữ chỗ, không nhảy layout) |
| empty | `EmptyState` (icon + tiêu đề + mô tả + hành động nếu có) |
| error | thông điệp theo `code` (i18n) + nút "Thử lại" |
| permission-disabled | ẩn nếu không bao giờ có quyền; disabled + tooltip lý do nếu quyền phụ thuộc ngữ cảnh (vd. ticket chưa nhận) |
| offline / reconnecting | banner trạng thái kết nối dùng chung (`ConnectionBanner`) |

Danh sách theo spec §3.2 (tên component trong code): `AppSidebar`, `InboxList`, `ConversationItem`, `ChatHeader`,
`MessageFeed`, `MessageBubble`, `MessageActions`, `ReplyPreview`, `ReactionBar`, `MessageComposer`, `AttachmentGrid`,
`UploadQueue`, `TypingIndicator`, `ReadReceipt`, `ChatDetailsDrawer`, `MemberList`, `PollCard`, `ReminderDialog`,
`SearchPanel`, `SessionCard`, `SupportTicketCard`, `SupportQueue`, `AdminDataTable`, `PermissionMatrix`,
`WebhookDeliveries`, `WidgetLauncher`, `EmbedProvider`. Primitive dùng chung: `Button`, `IconButton`, `Input`, `Textarea`,
`Field`, `Dialog`, `AlertDialog`, `Sheet`, `DropdownMenu`, `Popover`, `Tooltip`, `Tabs`, `Switch`, `Checkbox`, `Avatar`,
`Badge`, `Skeleton`, `Spinner`, `EmptyState`.

## 9. Accessibility (ưu tiên 1 của skill)

- Tương phản chữ ≥ 4.5:1 (cả hai theme, bảng §2), thành phần phi văn bản mang nghĩa ≥ 3:1.
- Focus luôn thấy: `outline: 2px solid var(--focus-ring); outline-offset: 2px` (không `outline-none` trơn).
- Dialog/Sheet/Menu: focus trap + ESC + trả focus về nút mở (Radix lo phần này).
- Nút chỉ có icon có `aria-label`; icon cạnh chữ có `aria-hidden`.
- Realtime: một vùng `role="status"` cho thông báo ngữ cảnh ("3 tin nhắn mới từ An"), không biến mọi badge thành live region;
  `aria-live="polite"` cho "đang nhập…" được throttle.
- Feed tin: `role="log"` + `aria-label`, mỗi tin có thời gian dạng `<time dateTime>`.
- Form: label hiển thị (không dùng placeholder thay label), lỗi ngay dưới ô (`aria-describedby`), submit lỗi → focus ô lỗi đầu
  tiên; đăng nhập cho phép password manager và dán (`autocomplete="email"`, `"current-password"`).
- Màu không phải tín hiệu duy nhất: online = chấm + chữ "Đang hoạt động" trong tooltip/header; trạng thái gửi = icon + text ẩn.
- Thao tác vuốt/kéo (nếu có) luôn có nút thay thế.

## 10. Checklist trước khi giao (từ `references/pro-rules.md` + quick-reference §1–3)

- [ ] Không emoji làm icon; icon một họ (lucide), một độ dày nét
- [ ] Token semantic, không hex trong component (`rg "#[0-9a-fA-F]{6}" src/features` phải rỗng)
- [ ] Tương phản ≥ 4.5:1 cả sáng & tối; viền/divider thấy rõ ở cả hai theme
- [ ] Focus thấy được ở mọi control, kể cả trong dialog
- [ ] Vùng chạm ≥ 44×44 trên `pointer: coarse`
- [ ] Reduced motion: không còn animation không cần thiết
- [ ] Container 375 / 480 / 768 / 900 / 1200+ đều đúng layout; không cuộn ngang
- [ ] Safe-area và bàn phím ảo không che composer/bottom nav
- [ ] Loading / empty / error / permission state có đủ
- [ ] Form có label, lỗi theo field, giữ lỗi sau submit
