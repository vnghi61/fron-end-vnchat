import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toApiError } from "@/core/api/errors";
import { errorMessage } from "@/core/i18n";

/**
 * Đổ lỗi server vào form: `fields[]` của backend → lỗi dưới đúng ô (chỉ những field form có);
 * phần còn lại trả về thông điệp chung (theo `code`) để hiện ở đầu form.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly Path<T>[],
): string | null {
  const apiError = toApiError(error);
  let mapped = 0;
  for (const f of apiError.fields) {
    const name = f.field as Path<T>;
    if (knownFields.includes(name)) {
      setError(name, { type: "server", message: errorMessage(apiError) });
      mapped++;
    }
  }
  if (mapped === 0 || apiError.code !== "CHAT-400-000") return errorMessage(apiError);
  return null;
}
