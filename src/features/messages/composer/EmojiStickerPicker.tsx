import { Smile } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/core/i18n";
import { useStickers } from "./stickers";
import {
  EmptyState,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/core/ui/components";

// Emoji là NỘI DUNG chèn vào tin (không dùng làm icon giao diện). Bộ nhỏ, cố định – không kéo thư viện emoji nặng.
const EMOJIS = [
  "😀",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "😎",
  "🤔",
  "😅",
  "😭",
  "😡",
  "😴",
  "👍",
  "👎",
  "👏",
  "🙏",
  "💪",
  "👌",
  "🙌",
  "🤝",
  "❤️",
  "💔",
  "🔥",
  "🎉",
  "✅",
  "❌",
  "⭐",
  "💯",
  "⚡",
  "☕",
  "🍀",
  "🎁",
  "📌",
  "📎",
  "⏰",
  "🚀",
];

export function EmojiStickerPicker({
  onEmoji,
  onSticker,
  allowStickers,
}: {
  onEmoji: (emoji: string) => void;
  onSticker: (packId: string, stickerId: string) => void;
  allowStickers: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "sticker">("emoji");
  const stickers = useStickers(open && allowStickers && tab === "sticker");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton label={t("composerMore.emoji")} icon={<Smile />} />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "emoji" | "sticker")}>
          <TabsList className="px-2">
            <TabsTrigger value="emoji">{t("stickers.emoji")}</TabsTrigger>
            {allowStickers && <TabsTrigger value="sticker">{t("stickers.title")}</TabsTrigger>}
          </TabsList>
          <TabsContent value="emoji" className="p-2">
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={t("stickers.insert", { emoji: e })}
                  onClick={() => onEmoji(e)}
                  className="flex aspect-square items-center justify-center rounded-sm text-xl hover:bg-muted"
                >
                  {e}
                </button>
              ))}
            </div>
          </TabsContent>
          {allowStickers && (
            <TabsContent value="sticker" className="max-h-72 overflow-y-auto p-2 scrollbar-thin">
              {stickers.isPending ? (
                <div className="grid grid-cols-4 gap-2" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-md" />
                  ))}
                </div>
              ) : stickers.isError ? (
                <EmptyState title={errorMessage(stickers.error)} />
              ) : !stickers.data.some((p) => p.stickers.length) ? (
                <EmptyState title={t("stickers.empty")} />
              ) : (
                stickers.data.map((pack) => (
                  <section key={pack.id} className="mb-2">
                    <h3 className="px-1 pb-1 text-xs font-medium text-muted-foreground">{pack.name}</h3>
                    <div className="grid grid-cols-4 gap-1">
                      {pack.stickers.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-label={t("message.sticker", { name: s.name || s.emoji })}
                          onClick={() => {
                            onSticker(pack.id, s.id);
                            setOpen(false);
                          }}
                          className="flex aspect-square items-center justify-center rounded-md p-1 hover:bg-muted"
                        >
                          {s.url ? (
                            <img src={s.url} alt="" loading="lazy" className="size-full object-contain" />
                          ) : (
                            <span className="text-3xl" aria-hidden="true">
                              {s.emoji}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
