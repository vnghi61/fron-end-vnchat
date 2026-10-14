import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

// ---------- container size (responsive theo container, không theo viewport – spec §3.1, §6.3) ----------

export type PaneSize = "small" | "medium" | "large" | "xlarge";

export const paneSizeOf = (width: number): PaneSize =>
  width >= 1200 ? "xlarge" : width >= 900 ? "large" : width >= 480 ? "medium" : "small";

/** Đo phần tử bằng ResizeObserver; trả ref + kích thước pane theo ngưỡng 480 / 900 / 1200. */
export function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width, size: paneSizeOf(width) };
}

// ---------- chiều cao vùng nhìn thấy (bàn phím ảo trên mobile/WebView) ----------

/** Ghi --app-height = visualViewport.height để composer không bị bàn phím ảo che. Gọi một lần ở root. */
export function useAppHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.style.setProperty("--app-height", `${Math.round(vv.height)}px`));
    };
    update();
    vv.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      root.style.removeProperty("--app-height");
    };
  }, []);
}

// ---------- media query ----------

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

// ---------- online / visibility ----------

export function useDocumentVisible() {
  return useSyncExternalStore(
    (cb) => {
      document.addEventListener("visibilitychange", cb);
      return () => document.removeEventListener("visibilitychange", cb);
    },
    () => document.visibilityState === "visible",
    () => true,
  );
}

export function useDebouncedValue<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
