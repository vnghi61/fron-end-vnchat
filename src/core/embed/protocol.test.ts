import { describe, expect, it } from "vitest";
import { parseHostMessage, resolveParentOrigin, safeExternalUrl } from "./protocol";

const host = (rest: Record<string, unknown>) => ({ source: "vnchat-host", v: 1, ...rest });

describe("parseHostMessage", () => {
  it("accepts well-formed messages", () => {
    expect(parseHostMessage(host({ type: "theme:set", theme: "dark" }))).toMatchObject({ type: "theme:set", theme: "dark" });
    expect(parseHostMessage(host({ type: "locale:set", locale: "en" }))).toMatchObject({ locale: "en" });
    expect(parseHostMessage(host({ type: "navigate", route: "/embed/c/abc123" }))).toMatchObject({ route: "/embed/c/abc123" });
    expect(parseHostMessage(host({ type: "viewport:set", height: 512.4 }))).toMatchObject({ height: 512 });
    expect(parseHostMessage(host({ type: "open" }))).toMatchObject({ type: "open" });
  });

  it.each([
    ["wrong source", { source: "evil", v: 1, type: "open" }],
    ["wrong version", { source: "vnchat-host", v: 2, type: "open" }],
    ["unknown type", host({ type: "token:set", token: "x" })],
    ["bad theme", host({ type: "theme:set", theme: "pink" })],
    ["bad locale", host({ type: "locale:set", locale: "fr" })],
    ["absolute url", host({ type: "navigate", route: "https://evil.example/embed" })],
    ["protocol-relative", host({ type: "navigate", route: "//evil.example/embed" })],
    ["path traversal", host({ type: "navigate", route: "/embed/../admin" })],
    ["route outside embed", host({ type: "navigate", route: "/admin/users" })],
    ["javascript url", host({ type: "navigate", route: "javascript:alert(1)" })],
    ["height NaN", host({ type: "viewport:set", height: Number.NaN })],
    ["height too large", host({ type: "viewport:set", height: 50_000 })],
    ["array", [host({ type: "open" })]],
    ["string", JSON.stringify(host({ type: "open" }))],
    ["class instance", Object.assign(new (class X {})(), host({ type: "open" }))],
  ])("rejects %s", (_name, data) => {
    expect(parseHostMessage(data)).toBeNull();
  });
});

describe("resolveParentOrigin", () => {
  const allowlist = ["https://crm.partner.vn", "http://127.0.0.1:5180"];

  it("uses ancestorOrigins when available and only if allow-listed", () => {
    expect(resolveParentOrigin({ allowlist, ancestorOrigins: ["https://crm.partner.vn"] })).toBe("https://crm.partner.vn");
    expect(resolveParentOrigin({ allowlist, ancestorOrigins: ["https://evil.example"] })).toBeNull();
  });

  it("falls back to the referrer origin", () => {
    expect(resolveParentOrigin({ allowlist, referrer: "http://127.0.0.1:5180/embed.html?x=1" })).toBe("http://127.0.0.1:5180");
    expect(resolveParentOrigin({ allowlist, referrer: "not a url" })).toBeNull();
  });

  it("does not trust a referrer when ancestorOrigins disagrees", () => {
    expect(
      resolveParentOrigin({ allowlist, ancestorOrigins: ["https://evil.example"], referrer: "https://crm.partner.vn/" }),
    ).toBeNull();
  });

  it("is disabled with an empty allowlist", () => {
    expect(resolveParentOrigin({ allowlist: [], ancestorOrigins: ["https://crm.partner.vn"] })).toBeNull();
  });
});

describe("safeExternalUrl", () => {
  it("allows only http(s)", () => {
    expect(safeExternalUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,hi")).toBeNull();
    expect(safeExternalUrl("/relative")).toBeNull();
  });
});
