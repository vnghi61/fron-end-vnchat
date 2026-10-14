import { Palette, UserRound, type LucideIcon } from "lucide-react";

type SettingsKey = "settings.profile" | "settings.appearance";

export interface SettingsEntry {
  path: string;
  labelKey: SettingsKey;
  icon: LucideIcon;
}

/** Mục cài đặt – thêm khi có màn tương ứng (sessions, blocks… ở Phase 3). */
export const SETTINGS_ENTRIES: SettingsEntry[] = [
  { path: "/settings/profile", labelKey: "settings.profile", icon: UserRound },
  { path: "/settings/appearance", labelKey: "settings.appearance", icon: Palette },
];
