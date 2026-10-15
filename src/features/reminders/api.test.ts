import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { qk } from "@/core/api/query";
import type { Page, Reminder } from "@/core/api/types";
import { applyReminder, toLocalInput, toOffsetISO } from "./api";

const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  _id: "r1",
  note: "Gọi khách",
  remindAt: "2026-10-20T02:00:00.000Z",
  remindAtLocal: "2026-10-20 09:00",
  timezone: "Asia/Ho_Chi_Minh",
  status: "scheduled",
  conversationId: null,
  messageId: null,
  firedAt: null,
  ...over,
});

const pages = (items: Reminder[]): InfiniteData<Page<Reminder>, string | undefined> => ({
  pages: [{ items, nextCursor: null, hasMore: false }],
  pageParams: [undefined],
});

describe("toOffsetISO", () => {
  it("keeps local wall time and appends the machine offset (server requires an offset)", () => {
    const d = new Date(2026, 9, 20, 9, 5, 7);
    const iso = toOffsetISO(d);
    expect(iso).toMatch(/^2026-10-20T09:05:07[+-]\d{2}:\d{2}$/);
    expect(new Date(iso).getTime()).toBe(d.getTime());
    expect(toLocalInput(d)).toBe("2026-10-20T09:05");
  });
});

describe("applyReminder", () => {
  it("moves a reminder to the list matching its new status", () => {
    const qc = new QueryClient();
    qc.setQueryData(
      qk.reminders("scheduled"),
      pages([reminder(), reminder({ _id: "r2", remindAt: "2026-10-21T02:00:00.000Z" })]),
    );
    qc.setQueryData(qk.reminders("fired"), pages([]));
    applyReminder(qc, reminder({ status: "fired", firedAt: "2026-10-20T02:00:01.000Z" }));
    const scheduled = qc.getQueryData<ReturnType<typeof pages>>(qk.reminders("scheduled"));
    const fired = qc.getQueryData<ReturnType<typeof pages>>(qk.reminders("fired"));
    expect(scheduled?.pages[0]?.items.map((r) => r._id)).toEqual(["r2"]);
    expect(fired?.pages[0]?.items.map((r) => r._id)).toEqual(["r1"]);
  });

  it("keeps scheduled reminders sorted soonest first", () => {
    const qc = new QueryClient();
    qc.setQueryData(qk.reminders("scheduled"), pages([reminder({ _id: "late", remindAt: "2026-12-01T00:00:00Z" })]));
    applyReminder(qc, reminder({ _id: "soon", remindAt: "2026-10-15T00:00:00Z" }));
    const data = qc.getQueryData<ReturnType<typeof pages>>(qk.reminders("scheduled"));
    expect(data?.pages[0]?.items.map((r) => r._id)).toEqual(["soon", "late"]);
  });
});
