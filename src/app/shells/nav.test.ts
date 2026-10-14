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
