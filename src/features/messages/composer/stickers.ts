import { useQuery } from "@tanstack/react-query";
import { api } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { StickerPack } from "@/core/api/types";

/** GET /api/stickers → StickerPack[] (do admin cấu hình). */
export const useStickers = (enabled: boolean) =>
  useQuery({
    queryKey: qk.stickers,
    queryFn: () => api.get<StickerPack[]>("/api/stickers"),
    enabled,
    staleTime: 10 * 60_000,
  });
