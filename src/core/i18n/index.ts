import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { vi as dateVi, enUS as dateEn } from "date-fns/locale";
import { errorKeyCandidates, toApiError } from "@/core/api/errors";
import { storage } from "@/core/lib/storage";
import { en } from "./locales/en";
import { vi } from "./locales/vi";

export type Locale = "vi" | "en";
export const LOCALES: Locale[] = ["vi", "en"];
const KEY = "vnchat.locale";

export const isLocale = (v: unknown): v is Locale => v === "vi" || v === "en";

export function initialLocale(): Locale {
  const saved = storage.get(KEY);
  return isLocale(saved) ? saved : "vi";
}

void i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: initialLocale(),
  fallbackLng: "vi",
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = i18n.language;

export function setLocale(locale: Locale, persist = true) {
  if (persist) storage.set(KEY, locale);
  document.documentElement.lang = locale;
  void i18n.changeLanguage(locale);
}

export const dateLocale = () => (i18n.language === "en" ? dateEn : dateVi);

/** Dịch khoá động (mã lỗi, kind tin hệ thống…) – kiểu khoá không biết trước lúc compile. */
export const tDynamic = (key: string, options?: Record<string, unknown>): string =>
  (i18n.t as unknown as (k: string, o?: Record<string, unknown>) => string)(key, options);

/** Thông điệp người dùng cho một lỗi bất kỳ (theo `code`, không bao giờ hiện `message` tiếng Anh của backend). */
export function errorMessage(error: unknown): string {
  const apiError = toApiError(error);
  const key = errorKeyCandidates(apiError).find((k) => i18n.exists(k)) ?? "errors.unknown";
  const text = tDynamic(key);
  if (apiError.retryAfter && apiError.status === 429)
    return `${text}. ${i18n.t("errors.retryAfter", { seconds: apiError.retryAfter })}`;
  return text;
}

export function useErrorMessage() {
  useTranslation(); // re-render khi đổi ngôn ngữ
  return errorMessage;
}

export default i18n;
