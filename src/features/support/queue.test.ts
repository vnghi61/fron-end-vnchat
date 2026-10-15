import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { Conversation, SupportInfo } from "@/core/api/types";
import { conversation, member, message, ME, OTHER } from "@/test/factories";
import {
  applyQueueConversation,
  applyQueueMessage,
  isSupportCustomer,
  matchesQueue,
  queueKey,
  queueParams,
  type QueueFilter,
  type QueueList,
} from "./queue";

const support = (over: Partial<SupportInfo> = {}): SupportInfo => ({
  status: "waiting_agent",
  assigneeId: null,
  assignee: null,
  customer: { _id: OTHER, name: "Khách", profileImage: "", kind: "visitor" },
  tags: [],
  meta: {},
  assignedAt: null,
  closedAt: null,
  rating: null,
  ratingNote: null,
  ...over,
});

const ticket = (id: string, over: Partial<SupportInfo> = {}, updatedAt = "2026-10-15T01:00:00.000Z"): Conversation =>
  conversation({
    _id: id,
    kind: "support",
    peer: undefined,
    members: [member(OTHER, "Khách")],
    createdBy: OTHER,
    myRole: null,
    support: support(over),
    updatedAt,
  });

const page = (items: Conversation[]): QueueList => ({
  pages: [{ items, nextCursor: null, hasMore: false }],
  pageParams: [undefined],
});

const ids = (qc: QueryClient, f: QueueFilter) =>
  qc.getQueryData<QueueList>(queueKey(f))?.pages.flatMap((p) => p.items.map((c) => c._id));

describe("queueParams", () => {
  it("maps tabs to backend filters", () => {
    expect(queueParams({ tab: "waiting", tag: "" })).toEqual({ status: "waiting_agent" });
    expect(queueParams({ tab: "mine", tag: "vip" })).toEqual({ status: "open", mine: "true", tag: "vip" });
    expect(queueParams({ tab: "all", tag: "" })).toEqual({ status: "all" });
  });
});

describe("matchesQueue", () => {
  it("puts an assigned ticket in mine/agent/all but not waiting", () => {
    const t = ticket("t1", { status: "agent", assigneeId: ME });
    expect(matchesQueue(t, { tab: "mine", tag: "" }, ME)).toBe(true);
    expect(matchesQueue(t, { tab: "agent", tag: "" }, ME)).toBe(true);
    expect(matchesQueue(t, { tab: "waiting", tag: "" }, ME)).toBe(false);
    expect(matchesQueue(t, { tab: "mine", tag: "" }, OTHER)).toBe(false);
  });

  it("respects the tag filter", () => {
    const t = ticket("t1", { tags: ["vip"] });
    expect(matchesQueue(t, { tab: "all", tag: "vip" }, ME)).toBe(true);
    expect(matchesQueue(t, { tab: "all", tag: "bao-gia" }, ME)).toBe(false);
  });
});

describe("applyQueueConversation", () => {
  it("moves a claimed ticket from waiting to mine", () => {
    const qc = new QueryClient();
    const waiting: QueueFilter = { tab: "waiting", tag: "" };
    const mine: QueueFilter = { tab: "mine", tag: "" };
    qc.setQueryData(queueKey(waiting), page([ticket("t1"), ticket("t2")]));
    qc.setQueryData(queueKey(mine), page([]));
    applyQueueConversation(qc, ticket("t1", { status: "agent", assigneeId: ME }), ME);
    expect(ids(qc, waiting)).toEqual(["t2"]);
    expect(ids(qc, mine)).toEqual(["t1"]);
  });

  it("puts a ticket with a new message on top of the tabs containing it", () => {
    const qc = new QueryClient();
    const all: QueueFilter = { tab: "all", tag: "" };
    qc.setQueryData(queueKey(all), page([ticket("t1"), ticket("t2")]));
    const moved = applyQueueMessage(qc, "t2", message({ conversationId: "t2", seq: 9, text: "alo" }), ME);
    expect(moved).toBe(true);
    expect(ids(qc, all)).toEqual(["t2", "t1"]);
    const first = qc.getQueryData<QueueList>(queueKey(all))?.pages[0]?.items[0];
    expect(first?.lastMessage?.preview).toBe("alo");
  });

  it("reports unknown tickets so the caller can refetch", () => {
    const qc = new QueryClient();
    expect(applyQueueMessage(qc, "nope", message({ conversationId: "nope" }), ME)).toBe(false);
  });
});

describe("isSupportCustomer", () => {
  it("is true only for the customer of a support conversation", () => {
    expect(isSupportCustomer(ticket("t1"), OTHER)).toBe(true);
    expect(isSupportCustomer(ticket("t1"), ME)).toBe(false);
    expect(isSupportCustomer(conversation(), ME)).toBe(false);
  });
});
