import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Message } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { cn } from "@/core/lib/cn";
import { Tooltip } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { toggleReaction } from "./api";

/** Dải cảm xúc dưới bong bóng: bấm để bật/tắt cảm xúc của mình; tooltip liệt kê người đã thả. */
export function ReactionBar({ message, nameOf }: { message: Message; nameOf: (id: string) => string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const meId = useSession((s) => s.bootstrap?.me._id);
  if (!message.reactions.length) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-1" aria-label={t("message.react")}>
      {message.reactions.map((r) => {
        const mine = !!meId && r.userIds.includes(meId);
        const names = r.userIds.map(nameOf).join(", ");
        return (
          <li key={r.emoji}>
            <Tooltip content={names || r.emoji}>
              <button
                type="button"
                aria-pressed={mine}
                aria-label={`${mine ? t("message.removeReaction", { emoji: r.emoji }) : t("message.reactWith", { emoji: r.emoji })} (${r.count})`}
                onClick={() => toggleReaction(qc, message, r.emoji).catch((e: unknown) => toast.error(e))}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs tabular-nums transition-colors coarse:h-8",
                  mine
                    ? "border-primary bg-primary-soft text-primary-strong"
                    : "border-border bg-surface text-foreground hover:bg-muted",
                )}
              >
                <span aria-hidden="true">{r.emoji}</span>
                {r.count}
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
