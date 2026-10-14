import { describe, expect, it } from "vitest";
import { paneSizeOf } from "@/core/ui/hooks";
import { safeNext } from "./navigation";

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
