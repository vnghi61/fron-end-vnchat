import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation, Message } from "@/core/api/types";
import { Input } from "@/core/ui/components";
import { useDebouncedValue } from "@/core/ui/hooks";
import { useMessageSearch } from "@/features/search/api";
import { MessageResults } from "./MessageResults";

/** Tìm trong hội thoại: khớp từ nguyên vẹn, bỏ dấu (backend §4.9) – nói rõ cho người dùng để không tưởng là lỗi. */
export function SearchTab({ conversation: c, onJump }: { conversation: Conversation; onJump: (m: Message) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q.trim(), 300);
  const query = useMessageSearch({ q: debounced, conversationId: c._id }, debounced.length > 0);
  return (
    <div className="flex flex-col">
      <div className="p-3 pb-1">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("details.searchPlaceholder")}
            aria-label={t("details.search")}
            className="pl-9"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("search.hint")}</p>
      </div>
      {debounced ? (
        <MessageResults query={query} empty={t("details.noResults")} onPick={onJump} />
      ) : (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("search.typeMore")}</p>
      )}
    </div>
  );
}
