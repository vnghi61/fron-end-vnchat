# Deploy – static frontend + header nhúng

VNChat web là SPA tĩnh (`npm run build` → `dist/`). Backend API ở origin riêng (`VITE_API_URL`) hoặc cùng origin qua
reverse proxy. Phần này chỉ nói về **header của static host**; backend không tham gia (contract map B8).

## Biến build (công khai – không bao giờ chứa secret)

| Biến | Ví dụ | Ý nghĩa |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://api.vnchat.vn` | origin API + Socket.IO; rỗng = cùng origin |
| `VITE_AUTH_TRANSPORT` | `cookie` / `bearer` | standalone khác site với API thì dùng `bearer` |
| `VITE_EMBED_PARENT_ORIGINS` | `https://crm.partner.vn,https://shop.partner.vn` | trang được nhúng `/embed`, `/widget` và trao đổi `postMessage` |

`/widget` và mọi trang chạy trong iframe luôn dùng Bearer + `credentials: "omit"` bất kể `VITE_AUTH_TRANSPORT`
(`src/main.tsx`, contract map B15).

## Header bắt buộc

| Đường dẫn | `Content-Security-Policy` |
| :--- | :--- |
| `/embed`, `/embed/*`, `/widget` | `frame-ancestors 'self' <các origin trong VITE_EMBED_PARENT_ORIGINS>` |
| mọi đường dẫn khác | `frame-ancestors 'self'` |

- **Cùng một danh sách origin** ở biến build và ở header – nếu lệch, hoặc khung bị chặn (header thiếu origin) hoặc khung
  hiện nhưng bridge tắt (biến build thiếu origin).
- Không đặt `X-Frame-Options: DENY` cho `/embed*` và `/widget` (nó thắng `frame-ancestors` ở vài trình duyệt cũ).
- `vnchat-widget.js` được trang host tải bằng `<script>` nên cần cache ngắn (`max-age=300`) để sửa lỗi lan nhanh; các file
  `assets/*` có hash nên cache dài (`immutable`).
- SPA fallback: mọi đường dẫn không phải file → `index.html`.

Dev server và `vite preview` áp đúng các header này (`vite.config.ts` → `frameAncestors`) để kiểm thử nhúng trước khi
deploy.

## Mẫu cấu hình

- `nginx.conf.template` – thay `${EMBED_FRAME_ANCESTORS}` bằng danh sách origin cách nhau bởi dấu cách
  (`envsubst '${EMBED_FRAME_ANCESTORS}' < nginx.conf.template > default.conf`).
- `render.yaml` – Render static site (header theo path; sửa danh sách origin cho đúng môi trường).

## Kiểm tra sau deploy

```bash
curl -sI https://chat.example.vn/embed | grep -i content-security-policy
curl -sI https://chat.example.vn/app | grep -i content-security-policy
```

Kỳ vọng: `/embed` liệt kê origin đối tác; `/app` chỉ `'self'`. Nhúng thử bằng trang mẫu `examples/host` (xem README gốc).

## Rollback

Static host giữ các bản deploy trước (Render: *Rollback* trên deploy cũ; nginx: trỏ symlink về thư mục build trước).
Đổi danh sách origin không cần build lại header nhưng **cần build lại bundle** vì `VITE_EMBED_PARENT_ORIGINS` được nhúng
lúc build.
