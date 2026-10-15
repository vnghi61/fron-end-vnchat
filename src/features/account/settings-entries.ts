import { Ban, MonitorSmartphone, Palette, UserRound, type LucideIcon } from "lucide-react";

type SettingsKey = "settings.profile" | "settings.appearance" | "settings.sessions" | "settings.blocks";

export interface SettingsEntry {
  path: string;
  labelKey: SettingsKey;
  icon: LucideIcon;
}

/** Mục cài đặt – chỉ thêm khi có màn tương ứng. */
export const SETTINGS_ENTRIES: SettingsEntry[] = [
  { path: "/settings/profile", labelKey: "settings.profile", icon: UserRound },
  { path: "/settings/appearance", labelKey: "settings.appearance", icon: Palette },
  { path: "/settings/sessions", labelKey: "settings.sessions", icon: MonitorSmartphone },
  { path: "/settings/blocks", labelKey: "settings.blocks", icon: Ban },
];
