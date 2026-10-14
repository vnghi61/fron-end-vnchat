import { describe, expect, it } from "vitest";
import { brandTokens } from "./branding";
import { contrast, parseHex } from "./color";

const c = (a: string, b: string) => contrast(parseHex(a)!, parseHex(b)!);

describe("brandTokens", () => {
  it("rỗng hoặc không phải hex → giữ indigo mặc định", () => {
    expect(brandTokens("", "light")).toBeNull();
    expect(brandTokens("red", "light")).toBeNull();
    expect(brandTokens("#12345", "light")).toBeNull();
  });

  it("màu tối → chữ trắng trên nút", () => {
    const t = brandTokens("#0F766E", "light")!;
    expect(t["--primary-foreground"]).toBe("#ffffff");
    expect(c(t["--primary-foreground"], t["--primary"])).toBeGreaterThanOrEqual(4.5);
  });

  it("màu sáng → chữ tối trên nút", () => {
    const t = brandTokens("#FACC15", "light")!;
    expect(t["--primary-foreground"]).toBe("#0b0d1a");
    expect(c(t["--primary-foreground"], t["--primary"])).toBeGreaterThanOrEqual(4.5);
  });

  it("màu chữ/link trên surface luôn đạt AA (làm tối dần ở theme sáng)", () => {
    const t = brandTokens("#FACC15", "light")!;
    expect(c(t["--primary-strong"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("màu xám giữa không đạt tương phản với cả trắng lẫn mực → bỏ brand", () => {
    expect(brandTokens("#777777", "light")).toBeNull();
  });
});
