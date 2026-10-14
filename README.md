# VNChat Web (2.0)

Frontend React cho [back-end-vnchat](https://github.com/vnghi61/back-end-vnchat): một codebase chạy **standalone**,
**iframe nhúng**, **widget hỗ trợ khách** và **WebView mobile**.

> Đang nâng cấp theo `VNCHAT-UI-UX-WEBVIEW-IMPLEMENTATION.md` (Phase 0 → 7). Trạng thái từng phase: `CHANGELOG.md`.

## Chạy local

```bash
npm install
cp .env.example .env.local          # tuỳ chọn
npm run dev                         # http://localhost:5174 – proxy /api, /socket.io → VITE_DEV_API_TARGET (mặc định :5001)
```

Backend: trong repo `back-end-vnchat` chạy `docker compose up -d --build` (API :5001 + MongoDB).
Backend chỉ cho CORS `http://localhost:5174` mặc định – vì vậy dev server cố định cổng 5174.

## Lệnh

| Lệnh | Việc |
| :--- | :--- |
| `npm run dev` | dev server |
| `npm run build` | typecheck + build production (`dist/`) |
| `npm run typecheck` / `npm run lint` / `npm test` | kiểm tra |
| `npm run check` | tất cả các bước trên (dùng trước khi commit) |
| `npm run gen:api` | sinh `src/core/api/generated/openapi.d.ts` từ OpenAPI thật của backend (`VNCHAT_OPENAPI=<file hoặc URL>`) |

## Tài liệu

- [docs/ui-vnchat-2-design-system.md](docs/ui-vnchat-2-design-system.md) – token, theme, typography, responsive, a11y
- [docs/frontend-backend-contract-map.md](docs/frontend-backend-contract-map.md) – màn hình ↔ API/event, blocker backend
- [docs/embed-webview-architecture.md](docs/embed-webview-architecture.md) – iframe, widget, WebView, bridge postMessage

## Cấu trúc

```text
src/
  app/        router, providers, shells, guards (lớp ghép: được import core + features)
  core/       api (axios, lỗi, kiểu contract), auth (session/bootstrap), realtime (socket), i18n, ui (token, component)
  features/   theo domain: auth, account, … (thêm khi triển khai)
  test/       setup Vitest, MSW server, fixture đúng contract
```
