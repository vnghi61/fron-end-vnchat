import { ApiError } from "@/core/api/errors";

const IMAGE_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Đọc ảnh thành data URI (ảnh đại diện/nhóm – server tự upload). Lỗi mang mã backend tương ứng để hiện đúng thông điệp. */
export function readImageAsDataUri(file: File, maxBytes: number): Promise<string> {
  if (!IMAGE_MIME.includes(file.type)) {
    return Promise.reject(new ApiError({ status: 400, code: "CHAT-400-007", message: "unsupported image type" }));
  }
  if (file.size > maxBytes) {
    return Promise.reject(new ApiError({ status: 413, code: "CHAT-413-001", message: "image too large" }));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ApiError({ status: 0, code: "UNKNOWN", message: "cannot read file" }));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number | undefined, locale = "vi-VN"): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i === 0 ? 0 : 1 }).format(value)} ${units[i]}`;
}
