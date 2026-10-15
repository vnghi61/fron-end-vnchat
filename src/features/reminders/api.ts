import { useInfiniteQuery, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { api, path } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { Id, Page, Reminder, ReminderStatus } from "@/core/api/types";
import { onSocketEvent } from "@/core/realtime/socket";

// Nhắc việc (§4.7): remindAt là ISO CÓ offset (30 giây – 1 năm tới), timezone IANA của máy.

export const reminderApi = {
  list: (status: ReminderStatus, cursor?: string) =>
    api.get<Page<Reminder>>("/api/reminders", { params: { status, cursor, limit: 30 } }),
  create: (body: { note: string; remindAt: string; timezone: string; conversationId?: Id; messageId?: Id }) =>
    api.post<Reminder>("/api/reminders", body),
  update: (id: Id, body: { note?: string; remindAt?: string; timezone?: string }) =>
    api.patch<Reminder>(path`/api/reminders/${id}`, body),
  cancel: (id: Id) => api.delete(path`/api/reminders/${id}`),
};

export const localTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** Date → "2026-10-20T09:00:00+07:00" theo giờ máy. */
export function toOffsetISO(d: Date): string {
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, "0");
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}

/** Giá trị cho <input type="datetime-local"> */
export const toLocalInput = (d: Date) => toOffsetISO(d).slice(0, 16);

export function useReminders(status: ReminderStatus) {
  return useInfiniteQuery({
    queryKey: qk.reminders(status),
    queryFn: ({ pageParam }) => reminderApi.list(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });
}

type ReminderPages = InfiniteData<Page<Reminder>, string | undefined>;

/** Đưa nhắc việc vào đúng danh sách theo status (bỏ khỏi các danh sách khác). */
export function applyReminder(qc: QueryClient, r: Reminder) {
  for (const status of ["scheduled", "fired", "cancelled"] as const) {
    qc.setQueryData<ReminderPages>(qk.reminders(status), (data) => {
      if (!data) return data;
      const pages = data.pages.map((p) => ({ ...p, items: p.items.filter((x) => x._id !== r._id) }));
      if (status === r.status && pages[0]) {
        const items = [...pages[0].items, r].sort((a, b) =>
          status === "scheduled"
            ? Date.parse(a.remindAt) - Date.parse(b.remindAt)
            : Date.parse(b.remindAt) - Date.parse(a.remindAt),
        );
        pages[0] = { ...pages[0], items };
      }
      return { ...data, pages };
    });
  }
}

export function registerReminderHandlers(qc: QueryClient, onFired: (r: Reminder) => void) {
  const offs = [
    onSocketEvent("reminder.created", ({ reminder }) => applyReminder(qc, reminder)),
    onSocketEvent("reminder.updated", ({ reminder }) => applyReminder(qc, reminder)),
    onSocketEvent("reminder.cancelled", ({ reminder }) => applyReminder(qc, reminder)),
    onSocketEvent("reminder.fired", ({ reminder }) => {
      applyReminder(qc, reminder);
      onFired(reminder);
    }),
  ];
  return () => offs.forEach((off) => off());
}
