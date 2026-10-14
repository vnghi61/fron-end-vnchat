import { create } from "zustand";
import { storage } from "@/core/lib/storage";
import { applyBrandTokens, brandTokens, type ResolvedTheme } from "./branding";

// Theme: system (mặc định) | light | dark. Lưu riêng UI (key trùng public/theme-init.js).

export type ThemePreference = "system" | "light" | "dark";
const KEY = "vnchat.theme";

const isPreference = (v: unknown): v is ThemePreference => v === "system" || v === "light" || v === "dark";

const media = () =>
  typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

const resolve = (pref: ThemePreference): ResolvedTheme =>
  pref === "system" ? (media()?.matches ? "dark" : "light") : pref;

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  brandColor: string | null;
  setPreference: (pref: ThemePreference, opts?: { persist?: boolean }) => void;
  setBrandColor: (color: string | null) => void;
}

const initial = (() => {
  const saved = storage.get(KEY);
  return isPreference(saved) ? saved : "system";
})();

export const useTheme = create<ThemeState>((set, get) => ({
  preference: initial,
  resolved: resolve(initial),
  brandColor: null,
  setPreference: (preference, { persist = true } = {}) => {
    if (persist) storage.set(KEY, preference);
    set({ preference, resolved: resolve(preference) });
    apply(get());
  },
  setBrandColor: (brandColor) => {
    set({ brandColor });
    apply(get());
  },
}));

function apply({ resolved, brandColor }: Pick<ThemeState, "resolved" | "brandColor">) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  applyBrandTokens(brandTokens(brandColor, resolved), root);
}

// Theo dõi hệ điều hành đổi sáng/tối khi đang ở "system".
media()?.addEventListener("change", () => {
  const { preference } = useTheme.getState();
  if (preference !== "system") return;
  useTheme.setState({ resolved: resolve("system") });
  apply(useTheme.getState());
});

apply(useTheme.getState());
