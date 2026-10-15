import { AlarmClock, MessagesSquare, Search, Settings, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  labelKey: "nav.chats" | "nav.people" | "nav.reminders" | "nav.search" | "nav.support" | "nav.settings";
  icon: LucideIcon;
  /** Hiện trong bottom nav (màn hẹp). */
  bottom?: boolean;
  /** Các tiền tố (sau base) cũng tính là mục này đang active, vd. "/c/" cho màn chat. "" = chỉ khớp đúng đường dẫn. */
  activePrefixes?: string[];
  badge?: "unread";
}

export const isNavActive = (item: NavItem, base: string, pathname: string) => {
  const path = pathname.replace(/\/+$/, "");
  const target = `${base}${item.to}`;
  if (path === target) return true;
  if (item.to && path.startsWith(`${target}/`)) return true;
  return (item.activePrefixes ?? []).some((p) => path.startsWith(`${base}${p}`));
};

/** Các mục điều hướng; mục chỉ được thêm khi màn hình tương ứng đã có contract + đã triển khai. */
export const NAV_ITEMS: NavItem[] = [
  { to: "", labelKey: "nav.chats", icon: MessagesSquare, bottom: true, activePrefixes: ["/c/"], badge: "unread" },
  { to: "/search", labelKey: "nav.search", icon: Search, bottom: true },
  { to: "/people", labelKey: "nav.people", icon: Users, bottom: true },
  { to: "/reminders", labelKey: "nav.reminders", icon: AlarmClock, bottom: true },
  { to: "/settings", labelKey: "nav.settings", icon: Settings, bottom: true },
];
