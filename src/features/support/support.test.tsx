import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { qk } from "@/core/api/query";
import type { Conversation, SupportInfo } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { TooltipProvider } from "@/core/ui/components";
import { bootstrap, userProfile } from "@/test/fixtures";
import { conversation, member, ME, OTHER } from "@/test/factories";
import { server } from "@/test/server";
import { applySupportUpdated } from "./api";
import { RatingForm } from "./RatingForm";
import { SupportBanner } from "./SupportBanner";

const support = (over: Partial<SupportInfo> = {}): SupportInfo => ({
  status: "waiting_agent",
  assigneeId: null,
  assignee: null,
  customer: { _id: ME, name: "Bình", profileImage: "", kind: "user" },
  tags: [],
  meta: {},
  assignedAt: null,
  closedAt: null,
  rating: null,
  ratingNote: null,
  ...over,
});

const ticket = (over: Partial<SupportInfo> = {}): Conversation =>
  conversation({ _id: "s1", kind: "support", peer: undefined, members: [member(ME, "Bình")], support: support(over) });

function renderWith(ui: React.ReactNode, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
  return qc;
}

beforeEach(() => {
  useSession.setState({
    status: "authenticated",
    bootstrap: bootstrap({ me: userProfile({ _id: ME }) }),
    notice: null,
  });
});

describe("SupportBanner", () => {
  it("shows who is helping and ends the conversation after confirmation", async () => {
    let closed = false;
    server.use(
      http.post("*/api/support/conversations/s1/close", () => {
        closed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const c = ticket({
      status: "agent",
      assigneeId: OTHER,
      assignee: { _id: OTHER, name: "Dung", profileImage: "", kind: "user" },
    });
    renderWith(<SupportBanner conversation={c} onNewConversation={() => undefined} />);
    expect(screen.getByRole("status")).toHaveTextContent("Dung đang hỗ trợ bạn");
    await userEvent.click(screen.getByRole("button", { name: "Kết thúc cuộc trò chuyện hỗ trợ" }));
    await userEvent.click(screen.getByRole("button", { name: "Kết thúc" }));
    expect(closed).toBe(true);
  });

  it("offers rating and a new conversation once closed", () => {
    renderWith(<SupportBanner conversation={ticket({ status: "closed" })} onNewConversation={() => undefined} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bắt đầu cuộc trò chuyện mới" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kết thúc cuộc trò chuyện hỗ trợ" })).not.toBeInTheDocument();
  });
});

describe("RatingForm", () => {
  it("supports arrow keys and posts the chosen rating", async () => {
    let body: unknown;
    server.use(
      http.post("*/api/support/conversations/s1/rate", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWith(<RatingForm conversationId="s1" />);
    const submit = screen.getByRole("button", { name: "Gửi đánh giá" });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "3 sao" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "4 sao" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "4 sao" })).toHaveFocus();
    await userEvent.type(screen.getByLabelText("Góp ý thêm"), "ok");
    await userEvent.click(submit);
    expect(body).toEqual({ rating: 4, note: "ok" });
  });
});

describe("applySupportUpdated", () => {
  // room conv không kèm người phụ trách → tải lại hội thoại ngay, kể cả khi không màn nào đang xem (widget thu nhỏ)
  const assigned = () => ({
    ...ticket({ status: "agent", assigneeId: OTHER, assignee: { _id: OTHER, name: "Dung", profileImage: "", kind: "user" } }),
    members: [member(ME, "Bình"), member(OTHER, "Dung")],
  });

  it("patches status from the conversation room and refetches when the assignee changes", async () => {
    let calls = 0;
    server.use(http.get("*/api/conversations/s1", () => (calls++, HttpResponse.json(assigned()))));
    const qc = new QueryClient();
    qc.setQueryData(qk.conversation("s1"), ticket());
    applySupportUpdated(qc, { conversationId: "s1", status: "agent", assigneeId: OTHER });
    const c = qc.getQueryData<Conversation>(qk.conversation("s1"));
    expect(c?.support?.status).toBe("agent");
    expect(c?.support?.assigneeId).toBe(OTHER);
    expect(c?.support?.assignee).toBeNull(); // chưa biết tên → banner nói chung chung, không giữ tên cũ
    await vi.waitFor(() => expect(qc.getQueryData<Conversation>(qk.conversation("s1"))?.support?.assignee?.name).toBe("Dung"));
    expect(calls).toBe(1);
  });

  it("keeps the refetched data even if a newer message patches the cache right after", async () => {
    server.use(http.get("*/api/conversations/s1", () => HttpResponse.json(assigned())));
    const qc = new QueryClient();
    qc.setQueryData(qk.conversation("s1"), ticket());
    applySupportUpdated(qc, { conversationId: "s1", status: "agent", assigneeId: OTHER });
    // tin mới tới ngay sau đó → setQueryData (trước đây xoá cờ invalidated và giữ dữ liệu cũ tới hết staleTime)
    qc.setQueryData<Conversation>(qk.conversation("s1"), (c) => (c ? { ...c, lastSeq: c.lastSeq + 1 } : c));
    await vi.waitFor(() =>
      expect(qc.getQueryData<Conversation>(qk.conversation("s1"))?.members.map((m) => m.user._id)).toContain(OTHER),
    );
  });

  it("takes the assignee name from current members while refetching", () => {
    server.use(http.get("*/api/conversations/s1", () => HttpResponse.json(assigned())));
    const qc = new QueryClient();
    qc.setQueryData(qk.conversation("s1"), { ...ticket(), members: [member(ME, "Bình"), member(OTHER, "Dung")] });
    applySupportUpdated(qc, { conversationId: "s1", status: "agent", assigneeId: OTHER });
    expect(qc.getQueryData<Conversation>(qk.conversation("s1"))?.support?.assignee?.name).toBe("Dung");
  });

  it("merges only shared fields from the agents-room payload (viewer null, B2)", () => {
    const qc = new QueryClient();
    qc.setQueryData(qk.conversation("s1"), { ...ticket(), myRole: "agent", unreadCount: 3 });
    applySupportUpdated(qc, {
      conversationId: "s1",
      status: "closed",
      assigneeId: null,
      conversation: { ...ticket({ status: "closed" }), myRole: null, unreadCount: 0 },
    });
    const c = qc.getQueryData<Conversation>(qk.conversation("s1"));
    expect(c?.support?.status).toBe("closed");
    expect(c?.myRole).toBe("agent");
    expect(c?.unreadCount).toBe(3);
  });
});
