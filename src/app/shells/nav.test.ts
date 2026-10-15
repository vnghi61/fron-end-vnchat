import { describe, expect, it } from "vitest";
import { isNavActive, NAV_ITEMS } from "./nav";

const chats = NAV_ITEMS.find((i) => i.labelKey === "nav.chats")!;
const settings = NAV_ITEMS.find((i) => i.labelKey === "nav.settings")!;

describe("isNavActive", () => {
  it("Trò chuyện active ở inbox và màn chat, không active ở cài đặt", () => {
    expect(isNavActive(chats, "/app", "/app")).toBe(true);
    expect(isNavActive(chats, "/app", "/app/c/123")).toBe(true);
    expect(isNavActive(chats, "/app", "/app/settings/profile")).toBe(false);
  });

  it("Cài đặt active ở mọi trang con", () => {
    expect(isNavActive(settings, "/compact", "/compact/settings/appearance")).toBe(true);
    expect(isNavActive(settings, "/compact", "/compact")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  it("giữ bottom nav ≤ 5 mục và mỗi mục chỉ active ở trang của nó", () => {
    expect(NAV_ITEMS.filter((i) => i.bottom).length).toBeLessThanOrEqual(5);
    const search = NAV_ITEMS.find((i) => i.labelKey === "nav.search")!;
    expect(isNavActive(search, "/app", "/app/search")).toBe(true);
    expect(isNavActive(search, "/app", "/app/settings")).toBe(false);
    expect(isNavActive(chats, "/app", "/app/people")).toBe(false);
  });
});
