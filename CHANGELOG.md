# Changelog

## [Unreleased] – VNChat 2.0

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
