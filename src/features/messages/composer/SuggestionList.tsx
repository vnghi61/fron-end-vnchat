import { useTranslation } from "react-i18next";
import { cn } from "@/core/lib/cn";
import { Avatar } from "@/core/ui/components";
import { suggestionKey, type Suggestion } from "./suggest";

/**
 * Listbox gợi ý nằm trên ô soạn. Focus vẫn ở textarea (aria-activedescendant) – ↑/↓ chọn, Enter/Tab chèn, Esc đóng.
 * onMouseDown preventDefault để bấm chuột không làm textarea mất focus.
 */
export function SuggestionList({
  id,
  items,
  active,
  onPick,
  onHover,
}: {
  id: string;
  items: Suggestion[];
  active: number;
  onPick: (s: Suggestion) => void;
  onHover: (index: number) => void;
}) {
  const { t } = useTranslation();
  if (!items.length) return null;
  const label = items[0]?.kind === "command" ? t("suggest.commands") : t("suggest.mentions");
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={label}
      className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-64 overflow-y-auto rounded-md border border-border bg-surface-raised p-1 shadow-md scrollbar-thin"
    >
      {items.map((s, i) => (
        <li
          key={suggestionKey(s)}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(s)}
          onMouseMove={() => i !== active && onHover(i)}
          className={cn(
            "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-sm coarse:min-h-11",
            i === active && "bg-muted",
          )}
        >
          {s.kind === "mention" ? (
            <>
              <Avatar src={s.item.avatar} name={s.item.name} size="xs" />
              <span className="truncate">{s.item.name}</span>
            </>
          ) : (
            <>
              <span className="font-mono text-sm font-semibold text-primary-strong">/{s.item.name}</span>
              <span className="truncate text-muted-foreground">{s.item.description}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
