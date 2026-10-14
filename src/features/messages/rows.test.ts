import { describe, expect, it } from "vitest";
import { conversation, member, message, ME, OTHER, PEER } from "@/test/factories";
import type { OutboxItem } from "./outbox";
import { buildRows, readersByMessage } from "./rows";

const at = (iso: string) => ({ createdAt: iso, updatedAt: iso });

describe("buildRows", () => {
  it("chèn phân cách ngày và gộp cụm tin cùng người trong 5 phút", () => {
    const msgs = [
      message({ seq: 1, ...at("2026-10-13T08:00:00Z") }),
      message({ seq: 2, ...at("2026-10-14T08:00:00Z") }),
      message({ seq: 3, ...at("2026-10-14T08:03:00Z") }),
      message({ seq: 4, ...at("2026-10-14T08:20:00Z") }),
      message({ seq: 5, senderId: ME, ...at("2026-10-14T08:21:00Z") }),
    ];
    const rows = buildRows(msgs, [], ME, null);
    expect(rows.map((r) => r.kind)).toEqual(["day", "message", "day", "message", "message", "message", "message"]);
    const m = rows.filter((r) => r.kind === "message");
    expect(m.map((r) => (r.kind === "message" ? [r.groupStart, r.groupEnd] : null))).toEqual([
      [true, true], // seq1: ngày khác
      [true, false], // seq2 + seq3 cùng cụm
      [false, true],
      [true, true], // seq4 cách 17 phút
      [true, true], // seq5 của tôi
    ]);
    expect(m[4]?.kind === "message" && m[4].mine).toBe(true);
  });

  it("vạch 'tin mới' đặt trước tin đầu tiên của người khác có seq > mốc đã đọc", () => {
    const msgs = [message({ seq: 1 }), message({ seq: 2, senderId: ME }), message({ seq: 3 }), message({ seq: 4 })];
    const rows = buildRows(msgs, [], ME, 2);
    const idx = rows.findIndex((r) => r.kind === "unread");
    expect(rows[idx + 1]).toMatchObject({ kind: "message", message: { seq: 3 } });
  });

  it("tin system không gộp cụm", () => {
    const rows = buildRows(
      [message({ seq: 1 }), message({ seq: 2, type: "system", text: "member.added" }), message({ seq: 3 })],
      [],
      ME,
      null,
    );
    expect(rows.map((r) => r.kind)).toEqual(["day", "message", "system", "message"]);
  });

  it("outbox: bỏ tin đã có bản thật cùng clientMsgId (không hiện hai bong bóng)", () => {
    const sent = message({ seq: 1, senderId: ME, clientMsgId: "a" });
    const outbox: OutboxItem[] = [
      {
        clientMsgId: "a",
        conversationId: "c1",
        body: { text: "x", clientMsgId: "a" },
        status: "sending",
        createdAt: sent.createdAt,
      },
      {
        clientMsgId: "b",
        conversationId: "c1",
        body: { text: "y", clientMsgId: "b" },
        status: "failed",
        createdAt: sent.createdAt,
      },
    ];
    const rows = buildRows([sent], outbox, ME, null);
    const pending = rows.filter((r) => r.kind === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ item: { clientMsgId: "b" } });
  });
});

describe("readersByMessage", () => {
  it("gắn mỗi người vào tin mới nhất họ đã đọc, bỏ qua chính tôi và tin system", () => {
    const msgs = [
      message({ seq: 1 }),
      message({ seq: 2, senderId: ME }),
      message({ seq: 3, type: "system" }),
      message({ seq: 4, senderId: ME }),
    ];
    const members = [
      member(ME, "Tôi", { lastReadSeq: 4 }),
      member(PEER, "Cường", { lastReadSeq: 3 }),
      member(OTHER, "Dung", { lastReadSeq: 4 }),
    ];
    const map = readersByMessage(msgs, members, ME);
    expect(map.get("m2")?.map((r) => r.user._id)).toEqual([PEER]);
    expect(map.get("m4")?.map((r) => r.user._id)).toEqual([OTHER]);
    expect(map.has("m3")).toBe(false);
    void conversation;
  });
});
