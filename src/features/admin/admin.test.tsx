import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/core/api/errors";
import { qk } from "@/core/api/query";
import type { Page, PolicyRule, UserProfile } from "@/core/api/types";
import { TooltipProvider } from "@/core/ui/components";
import { userProfile } from "@/test/fixtures";
import { AdminError, SecretOnceDialog } from "./AdminPage";
import { applyAdminUser } from "./api";
import { adminKeepsPolicyWrite, sameRules, toMatrix, toRules } from "./policy-matrix";

const OBJECTS = ["chat", "support", "admin:*", "admin:policies", "admin:webhooks"];
const DEFAULTS: PolicyRule[] = [
  { sub: "admin", obj: "admin:*", act: "*" },
  { sub: "admin", obj: "chat", act: "*" },
  { sub: "agent", obj: "support", act: "*" },
  { sub: "member", obj: "chat", act: "*" },
];

describe("policy matrix", () => {
  it("builds one row per role, including base roles without rules", () => {
    const m = toMatrix([{ sub: "auditor", obj: "admin:webhooks", act: "read" }], OBJECTS);
    expect(Object.keys(m)).toEqual(["admin", "agent", "member", "auditor"]);
    expect(m.auditor?.["admin:webhooks"]).toBe("read");
    expect(m.member?.chat).toBe("none");
  });

  it("shows read + write as full access and round-trips back to rules", () => {
    const m = toMatrix(
      [
        { sub: "agent", obj: "chat", act: "read" },
        { sub: "agent", obj: "chat", act: "write" },
      ],
      OBJECTS,
    );
    expect(m.agent?.chat).toBe("*");
    expect(toRules(m)).toEqual([{ sub: "agent", obj: "chat", act: "*" }]);
  });

  it("mirrors the backend lock-out guard (admin keeps write on admin:policies)", () => {
    expect(adminKeepsPolicyWrite(DEFAULTS)).toBe(true);
    expect(adminKeepsPolicyWrite([{ sub: "admin", obj: "admin:policies", act: "write" }])).toBe(true);
    expect(adminKeepsPolicyWrite([{ sub: "admin", obj: "admin:policies", act: "read" }])).toBe(false);
    expect(adminKeepsPolicyWrite(DEFAULTS.filter((r) => r.obj !== "admin:*"))).toBe(false);
  });

  it("compares rule sets regardless of order", () => {
    expect(sameRules(DEFAULTS, [...DEFAULTS].reverse())).toBe(true);
    expect(sameRules(DEFAULTS, DEFAULTS.slice(1))).toBe(false);
  });
});

describe("AdminError", () => {
  it("turns a 403 into a permission message instead of an error (B3)", () => {
    render(<AdminError error={new ApiError({ status: 403, code: "CHAT-403-000", message: "forbidden" })} />);
    expect(screen.getByText("Bạn không có quyền xem mục này")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("offers retry for other errors", async () => {
    const retry = vi.fn();
    render(<AdminError error={new ApiError({ status: 500, code: "CHAT-500-000", message: "boom" })} onRetry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalled();
  });
});

describe("SecretOnceDialog", () => {
  it("shows the secret once and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const onClose = vi.fn();
    render(
      <TooltipProvider>
        <SecretOnceDialog label="Secret ký HMAC" secret="s3cr3t-value-123456" onClose={onClose} />
      </TooltipProvider>,
    );
    expect(screen.getByText("s3cr3t-value-123456")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenCalledWith("s3cr3t-value-123456");
    await userEvent.click(screen.getByRole("button", { name: "Tôi đã lưu" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("applyAdminUser", () => {
  it("replaces the user in every cached page of every filter", () => {
    const qc = new QueryClient();
    const u = userProfile({ _id: "u1", name: "Dung", roles: ["agent", "member"] });
    const pages = (items: UserProfile[]) => ({
      pages: [{ items, nextCursor: null, hasMore: false } as Page<UserProfile>],
      pageParams: [undefined],
    });
    qc.setQueryData(qk.admin("users", "a"), pages([u]));
    qc.setQueryData(qk.admin("users", "b"), pages([u]));
    applyAdminUser(qc, { ...u, roles: ["member"] });
    for (const key of ["a", "b"])
      expect(qc.getQueryData<ReturnType<typeof pages>>(qk.admin("users", key))?.pages[0]?.items[0]?.roles).toEqual([
        "member",
      ]);
  });
});
