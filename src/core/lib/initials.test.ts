import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("uses the last two words of a Vietnamese name", () => {
    expect(initials("Lê Văn Cường")).toBe("VC");
    expect(initials("an")).toBe("A");
  });

  it("ignores punctuation and prefers words that start with a letter", () => {
    expect(initials("QA P3 68296 (đổi)")).toBe("PĐ");
    expect(initials("2026 12")).toBe("21");
    expect(initials("  ")).toBe("?");
  });
});
