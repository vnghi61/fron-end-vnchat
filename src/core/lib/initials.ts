// Hai chữ đầu của 2 từ cuối (tên Việt: "Lê Văn Cường" → "VC"). Bỏ ký tự không phải chữ/số ("(đổi)" → "đổi") và ưu tiên
// từ bắt đầu bằng chữ cái để tên nhóm như "QA P3 68296" không ra "6(".
export const initials = (name: string) => {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const lettered = words.filter((w) => /^\p{L}/u.test(w));
  return (
    (lettered.length ? lettered : words)
      .slice(-2)
      .map((w) => [...w][0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
};
