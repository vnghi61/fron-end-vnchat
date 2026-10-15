import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Id } from "@/core/api/types";
import { cn } from "@/core/lib/cn";
import { Button, Textarea } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { rateSupport } from "./api";

/** Đánh giá 1–5 sao sau khi đóng (POST …/rate). Radiogroup: ←/→ đổi điểm, roving tabindex như radio gốc. */
export function RatingForm({ conversationId }: { conversationId: Id }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (e: KeyboardEvent, value: number) => {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, (value || 1) + (value ? delta : 0)));
    setRating(next);
    refs.current[next - 1]?.focus();
  };

  const submit = async () => {
    setBusy(true);
    try {
      await rateSupport(qc, conversationId, rating, note.trim() || undefined);
      toast.success(t("support.rated"));
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (rating) void submit();
      }}
    >
      <p id={`${conversationId}-rate`} className="text-sm font-medium">
        {t("support.rateTitle")}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${conversationId}-rate`}
        aria-describedby={`${conversationId}-rate-hint`}
        className="flex gap-1"
      >
        {[1, 2, 3, 4, 5].map((value) => {
          const active = value <= rating;
          return (
            <button
              key={value}
              ref={(el) => {
                refs.current[value - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={t("support.rateStar", { count: value })}
              tabIndex={rating ? (rating === value ? 0 : -1) : value === 1 ? 0 : -1}
              onClick={() => setRating(value)}
              onKeyDown={(e) => move(e, rating)}
              className="flex size-10 items-center justify-center rounded-md hover:bg-muted coarse:size-11"
            >
              <Star
                aria-hidden="true"
                className={cn(
                  "size-6 transition-colors",
                  active ? "fill-warning text-warning" : "text-muted-foreground",
                )}
              />
            </button>
          );
        })}
      </div>
      <p id={`${conversationId}-rate-hint`} className="sr-only">
        {t("support.rateGroup")}
      </p>
      {rating > 0 && (
        <Textarea
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("support.rateNote")}
          aria-label={t("support.rateNote")}
        />
      )}
      <Button type="submit" size="sm" className="self-start" disabled={!rating} loading={busy}>
        {t("support.rateSubmit")}
      </Button>
    </form>
  );
}
