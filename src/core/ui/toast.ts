import { toast as sonner } from "sonner";
import { errorMessage } from "@/core/i18n";

// Một thư viện toast duy nhất (Sonner – có live region sẵn). Lỗi API luôn qua errorMessage (theo `code`).

export const toast = {
  success: (message: string) => sonner.success(message),
  info: (message: string, opts?: { action?: { label: string; onClick: () => void }; duration?: number }) =>
    sonner(message, opts),
  error: (error: unknown) => sonner.error(typeof error === "string" ? error : errorMessage(error)),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};
