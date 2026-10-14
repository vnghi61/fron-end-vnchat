import { differenceInCalendarDays, format, formatDistanceToNowStrict, isSameYear } from "date-fns";
import i18n, { dateLocale } from "@/core/i18n";

// Mọi thời gian từ backend là ISO UTC → hiển thị theo giờ máy, locale theo ngôn ngữ đang chọn.

const parse = (iso: string | Date) => (iso instanceof Date ? iso : new Date(iso));

/** Giờ của một tin: 14:05 */
export const formatClock = (iso: string | Date) => format(parse(iso), "HH:mm");

/** Nhãn ngày phân cách trong feed: Hôm nay / Hôm qua / Thứ Hai, 13 tháng 10 / 13/10/2025 */
export function formatDayLabel(iso: string | Date, now = new Date()): string {
  const d = parse(iso);
  const diff = differenceInCalendarDays(now, d);
  if (diff === 0) return i18n.t("chat.today");
  if (diff === 1) return i18n.t("chat.yesterday");
  if (diff < 7) return format(d, "EEEE, d MMMM", { locale: dateLocale() });
  return format(d, isSameYear(d, now) ? "d MMMM" : "d MMMM yyyy", { locale: dateLocale() });
}

/** Thời gian ngắn ở inbox: 14:05 (hôm nay) · T2 (trong tuần) · 13/10 · 13/10/25 */
export function formatShortTime(iso: string | Date, now = new Date()): string {
  const d = parse(iso);
  const diff = differenceInCalendarDays(now, d);
  if (diff === 0) return formatClock(d);
  if (diff < 7) return format(d, "EEE", { locale: dateLocale() });
  return format(d, isSameYear(d, now) ? "dd/MM" : "dd/MM/yy");
}

/** "5 phút trước" */
export const formatRelative = (iso: string | Date) =>
  formatDistanceToNowStrict(parse(iso), { addSuffix: true, locale: dateLocale() });

/** Ngày giờ đầy đủ cho tooltip / thuộc tính title. */
export const formatFull = (iso: string | Date) => format(parse(iso), "PPpp", { locale: dateLocale() });

export const isSameDay = (a: string, b: string) => differenceInCalendarDays(parse(a), parse(b)) === 0;
