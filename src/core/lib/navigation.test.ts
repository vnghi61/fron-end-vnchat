import { describe, expect, it } from "vitest";
import { paneSizeOf } from "@/core/ui/hooks";
import { isEmbeddableRoute, safeNext } from "./navigation";

describe("safeNext (chống open redirect)", () => {
  it.each([
    [null, "/app"],
    ["/app/c/123", "/app/c/123"],
    [encodeURIComponent("/admin/users?q=a"), "/admin/users?q=a"],
    ["https://evil.example", "/app"],
    ["//evil.example", "/app"],
    ["/\\evil.example", "/app"],
    ["javascript:alert(1)", "/app"],
    ["%E0%A4%A", "/app"],
  ])("%s → %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    ["/embed/c/123", "/embed/c/123"],
    ["/embed", "/embed"],
    ["/embed?x=1", "/embed?x=1"],
    [encodeURIComponent("/admin/users"), "/embed"],
    ["/app", "/embed"],
    ["/embedded-evil", "/embed"],
    ["//evil.example/embed", "/embed"],
  ])("trong khung nhúng: %s → %s", (input, expected) => {
    expect(safeNext(input, "/embed", "/embed")).toBe(expected);
  });
});

describe("isEmbeddableRoute", () => {
  it.each([
    ["/embed", true],
    ["/embed/login", true],
    ["/widget", true],
    ["/embedded", false],
    ["/app", false],
    ["/admin/users", false],
    ["/support", false],
  ])("%s → %s", (path, ok) => {
    expect(isEmbeddableRoute(path)).toBe(ok);
  });
});

describe("paneSizeOf (ngưỡng container 480 / 900 / 1200)", () => {
  it.each([
    [320, "small"],
    [479, "small"],
    [480, "medium"],
    [899, "medium"],
    [900, "large"],
    [1199, "large"],
    [1200, "xlarge"],
  ])("%i px → %s", (w, size) => {
    expect(paneSizeOf(w)).toBe(size);
  });
});
