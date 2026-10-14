import { contrast, mix, parseHex, toHex, type RGB } from "./color";

// Áp bootstrap.branding.primaryColor có kiểm soát tương phản (docs/ui-vnchat-2-design-system.md §2.3).

export type ResolvedTheme = "light" | "dark";

const WHITE: RGB = [255, 255, 255];
const INK: RGB = [11, 13, 26]; // #0B0D1A
const SURFACE: Record<ResolvedTheme, RGB> = { light: [255, 255, 255], dark: [22, 25, 34] };
const AA = 4.5;

export interface BrandTokens {
  "--primary": string;
  "--primary-foreground": string;
  "--primary-hover": string;
  "--focus-ring": string;
  "--bubble-mine": string;
  "--bubble-mine-foreground": string;
  "--primary-strong": string;
}

/** Trả về token ghi đè, hoặc `null` để giữ indigo mặc định. Hàm thuần – có unit test. */
export function brandTokens(primaryColor: string | null | undefined, theme: ResolvedTheme): BrandTokens | null {
  const base = primaryColor ? parseHex(primaryColor) : null;
  if (!base) return null;

  const onBrand = contrast(WHITE, base) >= AA ? WHITE : contrast(INK, base) >= AA ? INK : null;
  if (!onBrand) return null;

  // Màu chữ/link trên surface: làm tối (sáng) hoặc sáng (tối) dần tới khi đạt AA, tối đa 10 bước.
  const surface = SURFACE[theme];
  const toward = theme === "light" ? ([0, 0, 0] as RGB) : WHITE;
  let strong = base;
  for (let i = 0; i < 10 && contrast(strong, surface) < AA; i++) strong = mix(strong, toward, 0.12);
  const strongOk = contrast(strong, surface) >= AA;

  const hover = mix(base, onBrand === WHITE ? [0, 0, 0] : WHITE, 0.15);
  const hex = toHex(base);
  return {
    "--primary": hex,
    "--primary-foreground": toHex(onBrand),
    "--primary-hover": toHex(hover),
    "--focus-ring": strongOk ? toHex(strong) : hex,
    "--bubble-mine": hex,
    "--bubble-mine-foreground": toHex(onBrand),
    "--primary-strong": strongOk ? toHex(strong) : hex,
  };
}

const APPLIED: (keyof BrandTokens)[] = [
  "--primary",
  "--primary-foreground",
  "--primary-hover",
  "--focus-ring",
  "--bubble-mine",
  "--bubble-mine-foreground",
  "--primary-strong",
];

export function applyBrandTokens(tokens: BrandTokens | null, root: HTMLElement = document.documentElement) {
  for (const name of APPLIED) {
    if (tokens) root.style.setProperty(name, tokens[name]);
    else root.style.removeProperty(name);
  }
}
