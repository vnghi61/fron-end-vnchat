// localStorage/sessionStorage có thể ném lỗi (iframe bên thứ ba, chặn cookie, private mode) → mọi truy cập bọc try/catch.

type Area = "local" | "session";

const area = (which: Area): Storage | null => {
  try {
    return which === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const storage = {
  get(key: string, which: Area = "local"): string | null {
    try {
      return area(which)?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string, which: Area = "local"): void {
    try {
      area(which)?.setItem(key, value);
    } catch {
      // storage bị chặn: chỉ giữ trong bộ nhớ của phiên
    }
  },
  remove(key: string, which: Area = "local"): void {
    try {
      area(which)?.removeItem(key);
    } catch {
      // bỏ qua
    }
  },
};
