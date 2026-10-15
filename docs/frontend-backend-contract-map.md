# Frontend ↔ Backend contract map

> Phase 0 của VNChat 2.0. Đối chiếu **code thật** của repo này với backend `back-end-vnchat`
> (nhánh `feature/chat-platform-features`, commit `b5a2b81`): `api/openapi.yaml`, `docs/realtime.md`,
> `docs/ui-features-and-e2e-flows.md`, bộ Bruno `api-tests/bruno` và mã nguồn controller/serializer (khi OpenAPI chỉ ghi
> mô tả chữ). Mọi field dưới đây đã đọc từ nguồn đó; chỗ nào backend **không có** thì ghi ở §6 "Blocker / gap", không mô
> phỏng.

## 1. Baseline frontend hiện tại (trước Phase 1)

| Kiểm tra | Kết quả |
| :--- | :--- |
| Git | `master` = `a05ce8d` (Initial commit, 31 file); nhánh làm việc `feature/vnchat-2-ui` |
| `npm run build` | ✅ (Vite 6.3.1, JS 341 KB / gzip 109 KB, CSS 47.5 KB gồm DaisyUI 5.0.25) |
| `npm run lint` | ❌ 3 lỗi có sẵn: `HomePage.jsx` import `useAuthStore` thừa; `ProfilePage.jsx` `handleUpdateProfile`/`data` không dùng |
| Test | không có |
| TypeScript | không (JSX thuần) |

### 1.1 Kiểm kê từng file

| File | Đang làm gì | Đối chiếu backend mới |
| :--- | :--- | :--- |
| `src/lib/axios.js` | axios `baseURL = VITE_API_URL`, `withCredentials` | OK cho cookie; không có Bearer, không chuẩn hoá lỗi `{message, code, fields}` |
| `src/store/useAuthStore.js` | `/auth/check`, `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/update-profile`; socket `io(BASE_URL, {query:{userId}})`, nghe `getOnlineUsers` | ❌ **socket bị từ chối**: backend xác thực handshake bằng JWT (`auth.token` → Bearer → cookie), bỏ `query.userId` (`src/lib/socket.js`). `/auth/check`, `/auth/update-profile` là *Legacy*. Không gọi bootstrap. `error.response.data.message` hiện thẳng tiếng Anh |
| `src/store/useChatStore.js` | `/messages/users`, `/messages/:id`, `/messages/send/:id`, `newMessage`, `selectedUser` | Legacy, còn chạy nhưng: không phân trang, không nhóm, không `clientMsgId`; `newMessage` chỉ phát cho direct |
| `src/components/Sidebar.jsx` | danh sách user + online | đọc `user.fullName`, `user.profilePic` – **backend chưa bao giờ trả** hai field này (trả `name`, `profileImage`) → tên/ảnh trống |
| `src/components/ChatHeader.jsx` | tên + online người đang chat | cùng lỗi `fullName`/`profilePic` |
| `src/components/ChatContainer.jsx` | render `message.text`, `message.image`; `ref` gắn vào **mọi** tin; `scrollIntoView` smooth mỗi lần đổi | không reply/reaction/xoá/sửa; scroll nhảy |
| `src/components/MessageInput.jsx` | text + ảnh data URI | không `clientMsgId`; ảnh base64 thẳng (backend vẫn nhận `image`, nhưng chuẩn mới là `attachments`) |
| `src/components/Navbar.jsx`, `NoChatSelected.jsx`, `AuthImagePattern.jsx`, skeletons | UI DaisyUI | "Welcome to Chatty!", mô tả "learn React, Tailwind CSS, and Firebase" không đúng sản phẩm |
| `src/pages/LoginPage.jsx` | form + validate tay; nút dùng `isSigningUp` (sai cờ – phải `isLoggingIn`); chữ "Loding..." | login trả **200** (cũ 201) – axios vẫn coi là thành công |
| `src/pages/SingUpPage.jsx` | form đăng ký | email trùng → 400 `CHAT-409-000`, đang hiện `message` tiếng Anh |
| `src/pages/ProfilePage.jsx` | đổi avatar qua `/auth/update-profile` | Legacy; chuẩn mới `PATCH /api/me {name?, profileImage?}` |
| `src/App.jsx` | 4 route `/`, `/signup`, `/login`, `/profile` | không shell, không guard theo quyền |
| `vite.config.js` | không cấu hình port/proxy | Vite mặc định 5173, backend mặc định chỉ cho CORS `http://localhost:5174` (`CLIENT_URL`) → dev phải chạy cổng 5174 hoặc proxy |

## 2. Quy ước kết nối

| Mục | Backend | Frontend 2.0 |
| :--- | :--- | :--- |
| Base URL | API + Socket.IO cùng cổng (mặc định 5001) | `VITE_API_URL` (rỗng = cùng origin). Dev: Vite proxy `/api`, `/socket.io` → `VITE_DEV_API_TARGET` (mặc định `http://localhost:5001`), chạy cổng **5174** |
| Auth HTTP | `extractToken`: `Authorization: Bearer` (trừ `ck_…`) → cookie `jwt` | `VITE_AUTH_TRANSPORT=cookie` (mặc định, cookie httpOnly, không lưu token) hoặc `bearer` (lưu token login/signup, gửi header) |
| Cookie | `httpOnly`, `SameSite` = `COOKIE_SAMESITE` (mặc định **strict**), `Secure` ở production / khi `none` | cookie chỉ dùng khi FE và API cùng site (hoặc reverse-proxy); khác site (Vercel ↔ Render, iframe bên thứ ba) → `bearer` |
| Auth socket | handshake `auth.token` → Bearer → cookie; lỗi → `connect_error` với `err.data.code` | `io(url, {auth:{token}})` ở bearer, `{withCredentials:true}` ở cookie; chỉ coi là "đã kết nối" sau `ready` |
| Lỗi | `{message, code, fields?}`; `429` có `Retry-After` | `ApiError` (`core/api/errors.ts`): `code` → i18n `errors.<code>`, `fields[]` → React Hook Form `setError`, `message` chỉ log dev |
| Phân trang | `{items, nextCursor, hasMore}`; tin nhắn `before`/`after`; cursor **opaque** (base64url) | không tự dựng cursor |
| Id / thời gian | `_id` 24 hex, ISO UTC | `date-fns` + `Intl`, locale `vi` |
| Tên hiển thị | `nicknames[userId]` (bootstrap) ưu tiên hơn `name` | `useDisplayName(userId, fallback)` |

## 3. Màn hình → API → event → module

| Mã | Màn hình | REST | Event nghe / phát | Module FE |
| :--- | :--- | :--- | :--- | :--- |
| 01 | Đăng nhập / ký | `POST /api/auth/login {email,password,device?}` → 200; `POST /api/auth/signup` → 201 | – | `features/auth` |
| – | Khởi động | `GET /api/me/bootstrap` | `ready` | `core/auth/session` |
| 02 | Inbox | `GET /api/conversations?limit=30[&kind][&archived=true]`; `?pinned=true` (không phân trang, ≤50); `POST /:id/mute {minutes}`, `/:id/pin {pinned}`, `/:id/archive {archived}` | `message.new`, `conversation.new/updated`, `conversation.member.added/removed`, `read.updated` | `features/inbox` |
| 03 | Chat 1-1 | `GET /api/users?q=` → `POST /api/conversations/direct {userId}` (201/200); `GET /:id`; `GET/POST /:id/messages`; `POST /:id/read {seq?}` | `message.*`, `reaction.updated`, `typing`, `read.updated`, `user.online/offline` | `features/conversations`, `features/messages` |
| 04 | Chat nhóm | `POST /api/conversations/group {title, memberIds, avatar?, avatarUrl?, historyVisibility?}` | + `conversation.updated` (đổi role dạng `{conversationId, memberId, role}`), tin `system` | `features/groups` |
| 05 | Composer, sticker | `GET /api/stickers` → `[{id,name,stickers:[{id,name,emoji,url}]}]`; gửi `{type:"sticker", sticker:{packId,stickerId}}`; `commandRules` từ bootstrap | emit `typing {conversationId, typing}` (ack `{ok}`) | `features/messages/composer` |
| 06 | Tệp / media | `POST /api/files/signature {conversationId}` → Cloudinary `uploadUrl` multipart → `attachments[{url, publicId, name, size, mime}]`; `GET /:id/media?kind=image\|video\|audio\|file\|link` | – | `features/uploads` |
| 07 | Bình chọn | `POST /:id/polls {question, options[2..10], multiple?, anonymous?, closesAt?, clientMsgId?}` → `{poll, message}`; `GET /api/polls/:id`; `PUT/DELETE /api/polls/:id/votes`; `POST /api/polls/:id/close` | `poll.updated` / `poll.closed` `{pollId, conversationId, messageId, counts:{[optionId]:n}, votersCount, status, closedAt?, closedBy?}` | `features/polls` |
| 08 | Nhắc việc | `GET /api/reminders?status=scheduled\|fired\|cancelled`; `POST {note, remindAt, timezone, conversationId?, messageId?}`; `PATCH/DELETE /:id` | `reminder.created/updated/cancelled/fired {reminder}` | `features/reminders` |
| 09 | Ghim & lưu trữ | `GET /:id/pins`; `POST/DELETE /:id/messages/:mid/pin`; inbox `archived`/`pinned` | `message.pinned/unpinned {conversationId, messageId, by, pinnedAt?}` | `features/conversations/details` |
| 10 | Tìm kiếm | `GET /api/messages/search?q&conversationId&senderId&type&from&to&cursor` (khớp từ nguyên vẹn, bỏ dấu; bỏ tin system/đã xoá); `GET /api/users?q=` (khớp đầu từ) | – | `features/search` |
| 11 | Quản lý nhóm | `GET /:id/members` → `[{user, role, joinedAt, lastReadSeq, online}]`; `POST /:id/members {memberIds}`; `PATCH /:id/members/:uid {role}` (204); `DELETE /:id/members/:uid` (204); `PATCH /:id`; `POST /:id/leave` (204) | `conversation.member.added {conversationId, memberIds, conversation}`, `conversation.member.removed {conversationId, memberId}` | `features/groups` |
| 12 | Hồ sơ, biệt danh | `GET/PATCH /api/me`; `GET /api/users/:id`; `PUT/DELETE /api/users/:id/nickname` | `nickname.updated {userId, nickname}` (`""` = xoá) | `features/account`, `features/people` |
| 13 | Online, chặn | `GET /api/presence?ids=` (≤200) → `[{userId, online, lastSeenAt}]`; `GET /api/blocks`; `POST/DELETE /api/blocks/:userId` | `user.online/offline {userId, at}`, `block.updated {userId, blocked}` | `features/people` |
| 14 | Thiết bị | `GET /api/auth/sessions` → `[{_id, device, userAgent, ip, createdAt, lastUsedAt, expiresAt, current}]`; `DELETE /api/auth/sessions/:id` (204); `POST /api/auth/logout-all` | `session.revoked {reason}` | `features/account` |
| 15 | Widget khách | `POST /api/widget/sessions {name?, email?, visitorToken?}` → `{user, token, visitorToken, welcomeMessage}`; `403 CHAT-403-001` = widget tắt | như chat | `features/widget` |
| 16 | Hỗ trợ (khách) | `POST /api/support/conversations {meta?, text?}` (201 mới / 200 đang mở); `GET /api/support/conversations/mine` (mảng); `POST /:id/close` (204); `POST /:id/rate {rating 1..5, note?}` (204) | `support.updated {conversationId, status, assigneeId, tags?, rating?}` – không kèm tên người phụ trách / thành viên mới → đổi `assigneeId` thì `GET /api/conversations/:id` ngay (kể cả khi widget đang thu nhỏ) | `features/support/customer` |
| 17 | Console agent | `GET /api/support/queue?status=open\|waiting_agent\|agent\|closed\|all&mine&tag`; `GET /api/support/stats`; emit `support:watch/unwatch` | `support.updated` (+`conversation`), `support.message {conversationId, status, assigneeId, message}` | `features/support/agent` |
| 18 | Chi tiết ticket | `POST .../assign {agentId?}`, `/transfer {agentId}`, `/release`, `/reopen`, `PUT .../tags {tags}` (204); `GET /api/support/agents` → `[UserBrief + online]` | `conversation.new` (agent mới), `conversation.member.removed` (agent cũ) | `features/support/agent` |
| 19 | Admin – người dùng | `GET /api/admin/users?q&kind&status&role&cursor` → `{items: UserProfile(+email, roles, status)}`; `PUT /users/:id/roles {roles}`; `PUT /users/:id/status {status}` | khoá → người bị khoá nhận `session.revoked {reason:"disabled"}` | `features/admin` |
| 20 | Admin – policy | `GET /api/admin/policies` → `{rules:[{sub,obj,act}], objects, actions}`; `PUT {rules}` | – | `features/admin` |
| 21 | Admin – cài đặt | `GET/PUT /api/admin/settings` → `{branding, commandRules[{name,description,enabled}], stickerPacks, widget{enabled, welcomeMessage}, updatedAt}` | – | `features/admin` |
| 22 | Admin – webhook | `GET` → `{items:[{_id,name,url,events,enabled,createdBy,createdAt,updatedAt}], events}`; `POST` → `{webhook, secret}` (secret **một lần**); `PUT/DELETE /:id`; `GET /:id/deliveries` → 100 bản ghi `{_id, event, status: pending\|delivered\|failed, attempts, lastStatusCode, lastError, deliveredAt, createdAt}`; `POST /deliveries/:id/redeliver` | – | `features/admin` |
| 23 | Admin – API key | `GET` → `{items:[{_id,name,prefix,scopes,status,expiresAt,lastUsedAt,botUserId,createdBy,createdAt,revokedAt}], scopes}`; `POST {name, scopes, expiresAt?}` → `{apiKey, key}` (key **một lần**); `DELETE /:id` | – | `features/admin` |
| 24 | Admin – audit | `GET /api/admin/audit?actorId&action&cursor` → `{items:[{_id, actorId, actorKind, action, targetType, targetId, metadata, ip, createdAt}], nextCursor, hasMore}` | – | `features/admin` |
| 25 | Embed đầy đủ | route FE `/embed`, `/embed/login`, `/embed/signup`, `/embed/c/:id`… (không phải endpoint); API như app thành viên, **Bearer** | bridge postMessage v1 (embed doc §3) | `core/embed`, `app/shells/EmbedRoot.tsx` |
| 26 | Mobile WebView | route FE `/compact/*` (không bridge) hoặc `/embed/*` (bridge) | native bridge `webkit.messageHandlers.vnchat` / `VNChatAndroid` / `ReactNativeWebView` nếu host inject; host → chat `window.vnchatHost.receive` | `core/embed/bridge.ts`, mẫu `examples/host/README.md` |

## 4. Realtime – quy tắc áp event (event router `core/realtime/eventRouter.ts`)

| Event | Áp vào | Ghi chú contract |
| :--- | :--- | :--- |
| `ready {userId}` | connection store → `ready`; chạy sync nếu đây là lần kết nối lại | chỉ sau `ready` socket mới ở đủ room |
| `message.new` (Message) | cache tin của hội thoại (upsert theo `_id`, khớp `clientMsgId` của outbox); inbox: `lastMessage`, `lastSeq`, `unreadCount+1` nếu không phải tôi gửi và hội thoại không đang mở; tự bỏ `archived` | backend tự bỏ lưu trữ khi có tin mới |
| `message.updated` (Message) | thay theo `_id` | |
| `message.deleted {conversationId, messageId, seq, deletedBy}` | đánh dấu `deletedAt`, xoá `text`/`attachments` hiển thị | payload không có `deletedAt` → dùng thời điểm nhận |
| `reaction.updated` (Message) | thay `reactions`, **tự tính lại `mine`** theo `userIds` | `mine` trong payload tính cho người thao tác |
| `message.pinned/unpinned` | `pinnedAt`/`pinnedBy`; invalidate `pins` | |
| `message.hidden {conversationId, messageId, hidden}` | ẩn/hiện (chỉ thiết bị khác của tôi) | bỏ ẩn → refetch trang để lấy lại tin |
| `typing {conversationId, user, typing, expiresAt}` | typing store riêng (không đụng cache tin), tự hết hạn theo `expiresAt` | |
| `read.updated {conversationId, userId, seq}` | `members[].lastReadSeq`; nếu `userId === me` (thiết bị khác) → `unreadCount = max(0, lastSeq - seq)` | |
| `conversation.new` (Conversation, tính riêng cho người nhận) | chèn đầu inbox | |
| `conversation.updated` – 3 dạng | (a) Conversation đầy đủ → **chỉ merge field dùng chung** (§6 B2); (b) `{conversationId, memberId, role}` → cập nhật role, nếu là tôi thì `myRole`; (c) `{conversationId, muted, mutedUntil, mutedForever, pinned, pinnedAt, archived}` → prefs | phân biệt bằng sự có mặt của `kind` / `memberId` / `muted` |
| `conversation.member.added` | thêm members; nếu tôi là người mới → chèn hội thoại (refetch `GET /:id` để có field riêng) | |
| `conversation.member.removed` | `memberId === me` → bỏ khỏi inbox, đóng chat đang mở (toast `CHAT-403-003`); khác → bỏ khỏi members | |
| `poll.updated/closed` | patch cache `poll:<id>`: `counts` (map optionId → số), `votersCount`, `status`; muốn biết ai bầu → refetch | |
| `reminder.*` | cache danh sách nhắc việc; `fired` → toast có nút mở `conversationId`/`messageId` | |
| `user.online/offline {userId, at}` | presence store (`lastSeenAt = at` khi offline) | chỉ contact (thành viên hội thoại chung) |
| `block.updated {userId, blocked}` | `blockedUserIds` trong session | |
| `nickname.updated {userId, nickname}` | `nicknames` trong session (`""` = xoá) | |
| `session.revoked {reason}` | xoá phiên → `/login` + thông báo theo `reason` (`disabled` / `logout_all`) | server ngắt socket ngay sau |
| `support.updated` | ticket trong inbox (khách) & hàng đợi (agent – có `conversation`) | |
| `support.message` | hàng đợi agent: preview/đưa lên đầu | chỉ room `agents` |
| `newMessage`, `getOnlineUsers` | **không nghe** ở client mới (Legacy) | gỡ hẳn khi bỏ màn legacy (Phase 7) |

Kết nối lại (spec §5.7): `connect` → chờ `ready` → `GET /api/sync?since=<mốc>&limit=500` → áp `conversations[]` + `messages[]`
→ lưu `until`. Mốc đầu tiên = `bootstrap.serverTime`. Sau sync luôn làm mới presence (`GET /api/presence?ids=`) và invalidate
trang đầu inbox (xem B1, B5).

## 5. Optimistic gửi tin

1. `clientMsgId = crypto.randomUUID()`; thêm vào **outbox** (Zustand) trạng thái `sending`.
2. `POST /:id/messages {text, clientMsgId, replyTo?, mentions?, attachments?}` → 201 (mới) / **200 (trùng `clientMsgId`, trả tin cũ)**.
3. Response hoặc `message.new` cùng `clientMsgId` (đến trước/sau đều được) → upsert vào cache, xoá khỏi outbox; render chỉ lấy
   outbox item chưa có trong cache → không bao giờ hai bong bóng.
4. Lỗi mạng/5xx → `failed` + nút "Thử lại" gửi lại **cùng** `clientMsgId`. Lỗi 4xx có `code` → `failed` + thông báo, không tự
   thử lại (vd. `CHAT-403-008` bị chặn, `CHAT-409-003` hỗ trợ đã đóng).

## 6. Blocker / gap (không mô phỏng – xử lý bằng UI an toàn)

| # | Vấn đề | Bằng chứng | Cách FE xử lý | Đề xuất backend |
| :--- | :--- | :--- | :--- | :--- |
| B1 | `/api/sync` khi `hasMore: true` không có cursor tiếp: `until` là *thời điểm gọi*, trang bị cắt theo `syncAt`/`updatedAt` nhưng response không trả `syncAt` → gọi lại với `since=until` **mất dữ liệu**, gọi lại `since` cũ **lặp vô hạn** | `controller/user.controller.js` `sync` | áp trang nhận được, rồi **fallback làm mới toàn bộ** (invalidate inbox + trang mới nhất của các hội thoại đang có cache) và đặt `since = until`; dùng `limit=500` để hiếm khi chạm | trả `nextSince` (max `syncAt`/`updatedAt` của trang) hoặc cursor |
| B2 | `conversation.updated` (đầy đủ), `conversation.member.added.conversation`, `support.updated.conversation` (room agents) được serialize với viewer `null` → `unreadCount=0`, `myRole=null`, `muted/pinned/archived=false`, `peer` sai | `toConversation(fresh, null)` trong `conversation.controller.js:37,236`, `support.service.js:53` | chỉ merge `title, avatarUrl, historyVisibility, members, memberCount, lastSeq, lastMessage, support, updatedAt`; field riêng giữ nguyên, thiếu thì `GET /:id` | gửi bản riêng theo `user:` hoặc tách payload chung |
| B3 | `bootstrap.permissions.admin` = quyền `admin:principals:read`; các mục admin khác dùng object riêng (`admin:webhooks`, `admin:settings`, `admin:audit`, `admin:api_keys`, `admin:policies`) – policy có thể cho xem user mà không cho webhook | `routes/admin.route.js`, `controller/user.controller.js` bootstrap | menu Admin theo `permissions.admin`; từng mục bắt `403` → trạng thái "Không có quyền" thay vì lỗi | trả `permissions.adminObjects` (danh sách object được read/write) |
| B4 | Không có endpoint công khai cho cấu hình widget (branding, bật/tắt) **trước** khi tạo session khách | không có route | launcher dùng theme/locale do host truyền; branding áp sau khi có session (`/api/me/bootstrap` cho phép khách); widget tắt chỉ biết khi `POST /api/widget/sessions` → `CHAT-403-001` → ẩn launcher | `GET /api/widget/config` công khai |
| B5 | `/api/sync` lọc `memberIds: me` → hội thoại tôi **bị xoá khỏi** trong lúc offline không xuất hiện | `sync` | sau sync invalidate trang đầu inbox; mở hội thoại cũ → `CHAT-403-003` → bỏ khỏi inbox | thêm `removedConversationIds` |
| B6 | Không có API "tin quanh seq" để nhảy tới kết quả tìm kiếm / tin ghim cũ | `listMessages` chỉ `before`/`after` (cursor opaque) | tải lùi từng trang tới khi có `seq` (tối đa 12 trang ≈ 600 tin), không thấy → thông báo "Tin quá cũ" | `?around=<messageId>` |
| B7 | Không có cơ chế đổi token một lần (SSO/host handoff) cho iframe nhúng | không có route | iframe đăng nhập trực tiếp bằng form (bearer, token trong storage partition của iframe); **không** nhận token qua URL/bridge | endpoint exchange one-time token, ràng buộc origin/audience |
| B8 | Không có cấu hình origin được phép nhúng / `siteId` ở backend | không có field | allowlist ở cấu hình deploy FE (`VITE_EMBED_PARENT_ORIGINS`) + header CSP `frame-ancestors` của static host (mẫu `deploy/`, dev server áp sẵn); `siteId` chỉ là nhãn công khai gửi vào `meta.siteId` của yêu cầu hỗ trợ | quản lý site/origin ở admin settings |
| B9 | Không có tổng unread realtime (chỉ `bootstrap.unreadTotal`) | realtime.md | FE tính tăng/giảm theo `message.new` / đọc; làm mới bằng bootstrap sau sync và khi quay lại foreground | event `unread.updated` |
| B10 | Upload phụ thuộc Cloudinary; chưa cấu hình → `features.uploads=false` | `cloudinaryConfigured()` | ẩn nút đính kèm, ảnh đại diện chỉ đổi bằng URL; môi trường dev không có Cloudinary không test được upload thật (unit test với XHR giả) | – |
| B11 | Danh sách admin users / audit không có tổng số, audit không lọc theo thời gian | controller | phân trang "Tải thêm", không hiển thị tổng | `total`, `from/to` |
| B12 | `message.deleted` không kèm `deletedAt` | realtime.md | dùng giờ nhận event | thêm `deletedAt` |
| B14 | OpenAPI thiếu vài field serializer thật có trả: `support.customer.contactEmail`, `Message.deletedBy`, `Conversation.peer` khai là `UserBrief` nhưng có thể `null`; bootstrap `branding`/`limits`, admin settings/webhook/api-key/audit chỉ mô tả bằng chữ | `lib/serializers.js`, `controller/admin.controller.js` | `src/core/api/types.ts` khai theo serializer và ghi nguồn; `contract-check.ts` chỉ cho phép field có trong OpenAPI ở các schema đã khai (field ngoài OpenAPI phải nằm trong kiểu lồng, có chú thích) | bổ sung schema vào `api/openapi.yaml` |
| B13 | Không có contract cho: gọi audio/video, push notification, SSO Google/Microsoft/Apple, upload chunk/resume, quản trị nhiều tenant, quản lý task ngoài lệnh `/task` | không có route/event | **không hiển thị** các tính năng này (không nút giả, không "sắp ra mắt") | cần thiết kế contract mới |
| B15 | `POST /api/widget/sessions` gọi `generateToken(…, res)` → **Set-Cookie `jwt`** cho phiên khách. Cùng trình duyệt đang đăng nhập app ở cùng origin API thì cookie thành viên bị thay bằng phiên khách | `controller/auth.controller.js#widgetSession`, `services/session.service.js#createSession` | tài liệu `/widget` chạy transport cách ly (`core/api/transport.ts`): axios fetch adapter + `credentials: "omit"` (không gửi, **không lưu** cookie kể cả cùng origin), Bearer với token riêng `vnchat.widget.token`; socket `withCredentials: false`, token qua `auth.token`. Phase 6 áp cùng cách ly cho `/embed*` và mọi trang chạy trong iframe (token `vnchat.embed.token`). Kịch bản E2E xác nhận phiên thành viên còn nguyên và không có cookie `jwt` nào được lưu trong iframe khác site | widget session không set cookie (chỉ trả token) |
| B16 | Tin hệ thống chỉ mang id (`support.transferred {fromAgentId, toAgentId}`, `support.assigned {agentId}`…); người đã rời hội thoại không còn trong `members`, và khách widget không gọi được `GET /api/users/:id` (requireUser) | `services/message.service.js#postSystemMessage`, `routes/user.route.js` | tài khoản đăng ký: tải tên qua `GET /api/users/:id` (cache 5 phút); khách: câu chung "được chuyển cho nhân viên khác" thay vì "Ai đó" | ghi tên hiển thị vào `metadata` của tin hệ thống |

## 7. Lộ trình bỏ API cũ

| API cũ | Thay bằng | Gỡ khỏi FE |
| :--- | :--- | :--- |
| `GET /api/auth/check` | `GET /api/me/bootstrap` (+ `GET /api/me`) | Phase 1 |
| `PUT /api/auth/update-profile` | `PATCH /api/me` | Phase 1 |
| socket `query: {userId}` + `getOnlineUsers` | JWT handshake + `ready` + `user.online/offline` + `GET /api/presence` | Phase 1 |
| `GET /api/messages/users` | `GET /api/conversations` + `GET /api/users?q=` | sau khi E2E inbox pass (Phase 7) |
| `GET /api/messages/:id`, `POST /api/messages/send/:id`, `newMessage` | `POST /api/conversations/direct` + `/messages` + `message.new` | sau khi E2E chat 1-1 pass (Phase 7) |
