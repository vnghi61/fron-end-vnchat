import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { qk } from "@/core/api/query";
import { useSession } from "@/core/auth/session";
import { flattenMessages, type MessagePages } from "@/features/messages/cache";
import { useOutbox } from "@/features/messages/outbox";
import { bootstrap } from "@/test/fixtures";
import { conversation, message, ME } from "@/test/factories";
import type { ConversationList } from "./cache";
import { onMessageNew } from "./realtime";
import { useChatUi } from "./ui-store";

let qc: QueryClient;
const inbox = () => qc.getQueryData<ConversationList>(qk.conversations("inbox"))!.pages[0]!.items;

beforeEach(() => {
  qc = new QueryClient();
  useSession.setState({ status: "authenticated", bootstrap: bootstrap({ unreadTotal: 2 }) });
  useChatUi.setState({ activeId: null });
  useOutbox.setState({ byConversation: {} });
  qc.setQueryData<ConversationList>(qk.conversations("inbox"), {
    pages: [
      {
        items: [conversation({ _id: "c0" }), conversation({ _id: "c1", unreadCount: 2, lastSeq: 5 })],
        nextCursor: null,
        hasMore: false,
      },
    ],
    pageParams: [undefined],
  });
  qc.setQueryData<MessagePages>(qk.messages("c1"), {
    pages: [{ items: [message({ seq: 5 })], nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  });
});

describe("message.new", () => {
  it("tin của người khác, hội thoại không mở → unread +1, lên đầu inbox, tổng chưa đọc +1", () => {
    onMessageNew(qc, message({ seq: 6, text: "xin chào" }));
    expect(inbox()[0]).toMatchObject({
      _id: "c1",
      unreadCount: 3,
      lastSeq: 6,
      lastMessage: { preview: "xin chào", seq: 6 },
    });
    expect(useSession.getState().bootstrap?.unreadTotal).toBe(3);
    expect(flattenMessages(qc.getQueryData(qk.messages("c1"))).map((m) => m.seq)).toEqual([5, 6]);
  });

  it("hội thoại đang mở và tab đang hiện → không tăng unread", () => {
    useChatUi.setState({ activeId: "c1" });
    onMessageNew(qc, message({ seq: 6 }));
    expect(inbox()[0]).toMatchObject({ _id: "c1", unreadCount: 2 });
    expect(useSession.getState().bootstrap?.unreadTotal).toBe(2);
  });

  it("tin của chính tôi (thiết bị khác) → unread về 0 và trừ khỏi tổng", () => {
    onMessageNew(qc, message({ seq: 6, senderId: ME }));
    expect(inbox()[0]).toMatchObject({ _id: "c1", unreadCount: 0 });
    expect(useSession.getState().bootstrap?.unreadTotal).toBe(0);
  });

  it("trùng clientMsgId với tin đang gửi → bỏ khỏi outbox (một bong bóng)", () => {
    useOutbox.getState().add({
      clientMsgId: "abc",
      conversationId: "c1",
      body: { text: "hi", clientMsgId: "abc" },
      status: "sending",
      createdAt: new Date().toISOString(),
    });
    onMessageNew(qc, message({ seq: 6, senderId: ME, clientMsgId: "abc" }));
    expect(useOutbox.getState().byConversation.c1).toEqual([]);
  });

  it("event lặp lại (sync + socket) không nhân đôi tin", () => {
    const m = message({ seq: 6 });
    onMessageNew(qc, m);
    onMessageNew(qc, m);
    expect(flattenMessages(qc.getQueryData(qk.messages("c1"))).map((x) => x.seq)).toEqual([5, 6]);
    expect(inbox()[0]?.unreadCount).toBe(3);
  });
});
