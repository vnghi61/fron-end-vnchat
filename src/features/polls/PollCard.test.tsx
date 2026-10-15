import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { Poll } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { TooltipProvider } from "@/core/ui/components";
import { bootstrap, userProfile } from "@/test/fixtures";
import { conversation, ME, PEER } from "@/test/factories";
import { server } from "@/test/server";
import { PollCard } from "./PollCard";

const poll = (over: Partial<Poll> = {}): Poll => ({
  _id: "p1",
  conversationId: "c1",
  messageId: "m1",
  question: "Ăn trưa ở đâu?",
  options: [
    { id: "a", text: "Phở", count: 0, voters: [] },
    { id: "b", text: "Cơm", count: 0, voters: [] },
  ],
  multiple: false,
  anonymous: false,
  status: "open",
  closesAt: null,
  closedAt: null,
  votersCount: 0,
  myOptionIds: [],
  createdBy: PEER,
  ...over,
});

function renderCard(myRole: "member" | "owner" | null = "member") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <PollCard pollId="p1" fallbackText="Ăn trưa ở đâu?" conversation={conversation({ kind: "group", myRole })} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useSession.setState({
    status: "authenticated",
    bootstrap: bootstrap({ me: userProfile({ _id: ME }) }),
    notice: null,
  });
});

describe("PollCard", () => {
  it("votes then shows results with my choice", async () => {
    let sent: unknown;
    server.use(
      http.get("*/api/polls/p1", () => HttpResponse.json(poll())),
      http.put("*/api/polls/p1/votes", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(
          poll({
            myOptionIds: ["a"],
            votersCount: 1,
            options: [
              { id: "a", text: "Phở", count: 1, voters: [{ _id: ME, name: "Bình", profileImage: "", kind: "user" }] },
              { id: "b", text: "Cơm", count: 0, voters: [] },
            ],
          }),
        );
      }),
    );
    renderCard();
    const vote = await screen.findByRole("button", { name: "Bình chọn" });
    expect(vote).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "Phở" }));
    await userEvent.click(vote);
    expect(sent).toEqual({ optionIds: ["a"] });
    expect(await screen.findByText("1 phiếu · 100%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đổi phiếu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rút phiếu" })).toBeInTheDocument();
    // không phải người tạo, không phải owner/admin → không có nút kết thúc
    expect(screen.queryByRole("button", { name: "Kết thúc bình chọn" })).not.toBeInTheDocument();
  });

  it("shows results only and no actions when closed", async () => {
    server.use(
      http.get("*/api/polls/p1", () => HttpResponse.json(poll({ status: "closed", closedAt: "2026-10-01T00:00:00Z" }))),
    );
    renderCard("owner");
    expect(await screen.findByText("Đã kết thúc")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bình chọn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kết thúc bình chọn" })).not.toBeInTheDocument();
  });

  it("lets a group owner close an open poll", async () => {
    server.use(http.get("*/api/polls/p1", () => HttpResponse.json(poll())));
    renderCard("owner");
    expect(await screen.findByRole("button", { name: "Kết thúc bình chọn" })).toBeInTheDocument();
  });

  it("is read-only for a viewer who is no longer a member", async () => {
    server.use(http.get("*/api/polls/p1", () => HttpResponse.json(poll())));
    renderCard(null);
    expect(await screen.findByText("Phở")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
