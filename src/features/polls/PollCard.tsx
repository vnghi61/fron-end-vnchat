import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { isApiError } from "@/core/api/errors";
import { qk } from "@/core/api/query";
import type { Conversation, Id, Poll } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { cn } from "@/core/lib/cn";
import { formatFull } from "@/core/lib/time";
import { Badge, Button, ConfirmDialog, Skeleton } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { pollApi, usePoll } from "./api";

/**
 * Thẻ bình chọn trong feed (màn 12). Chưa bỏ phiếu → chọn rồi bấm "Bình chọn"; đã bỏ phiếu / đã đóng → thanh kết quả.
 * Số đếm realtime đến từ poll.updated/closed (registerPollHandlers); danh sách người chọn chỉ có khi không ẩn danh.
 */
export function PollCard({
  pollId,
  fallbackText,
  conversation,
}: {
  pollId?: Id;
  fallbackText: string;
  conversation: Conversation;
}) {
  const { t } = useTranslation();
  const query = usePoll(pollId);
  if (!pollId || query.isError)
    return (
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5 shrink-0" aria-hidden="true" />
        <span className="font-medium">{t("message.poll", { text: fallbackText })}</span>
      </div>
    );
  if (query.isPending)
    return (
      <div className="flex flex-col gap-2" aria-label={t("polls.loading")} role="status">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  return <PollBody poll={query.data} conversation={conversation} />;
}

function PollBody({ poll: p, conversation: c }: { poll: Poll; conversation: Conversation }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const groupId = useId();
  const [choice, setChoice] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"vote" | "retract" | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const open = p.status === "open" && (!p.closesAt || new Date(p.closesAt) > new Date());
  const canVote = open && c.myRole !== null;
  const voted = p.myOptionIds.length > 0;
  const choosing = canVote && (!voted || editing);
  const canClose = open && c.myRole !== null && (p.createdBy === meId || c.myRole === "owner" || c.myRole === "admin");
  const total = p.options.reduce((n, o) => n + o.count, 0);

  const setPoll = (next: Poll) => qc.setQueryData(qk.poll(p._id), next);
  const handle = (error: unknown) => {
    toast.error(error);
    if (isApiError(error, "CHAT-409-007")) void qc.invalidateQueries({ queryKey: qk.poll(p._id) });
  };

  const vote = async () => {
    setBusy("vote");
    try {
      setPoll(await pollApi.vote(p._id, choice));
      setEditing(false);
    } catch (error) {
      handle(error);
    } finally {
      setBusy(null);
    }
  };
  const retract = async () => {
    setBusy("retract");
    try {
      await pollApi.retract(p._id);
      setPoll({ ...p, myOptionIds: [] });
      setChoice([]);
      void qc.invalidateQueries({ queryKey: qk.poll(p._id) });
    } catch (error) {
      handle(error);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: string, checked: boolean) =>
    setChoice((cur) => (p.multiple ? (checked ? [...cur, id] : cur.filter((x) => x !== id)) : checked ? [id] : []));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <BarChart3 className="mt-0.5 size-5 shrink-0 text-primary-strong" aria-hidden="true" />
        <p id={`${groupId}-q`} className="font-semibold break-words [overflow-wrap:anywhere]">
          {p.question}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {!open && <Badge>{t("polls.closed")}</Badge>}
        {p.anonymous && <Badge>{t("polls.anonymousLabel")}</Badge>}
        {p.multiple && <Badge>{t("polls.multipleLabel")}</Badge>}
        {open && p.closesAt && (
          <Badge tone="warning">{t("polls.closesAtLabel", { time: formatFull(p.closesAt) })}</Badge>
        )}
      </div>

      {choosing ? (
        <fieldset aria-labelledby={`${groupId}-q`} className="flex flex-col gap-1.5">
          {p.options.map((o) => {
            const checked = choice.includes(o.id);
            return (
              <label
                key={o.id}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors coarse:min-h-11",
                  checked ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                )}
              >
                <input
                  type={p.multiple ? "checkbox" : "radio"}
                  name={groupId}
                  checked={checked}
                  onChange={(e) => toggle(o.id, e.target.checked)}
                  className="size-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1 break-words">{o.text}</span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <ul className="flex flex-col gap-2" aria-labelledby={`${groupId}-q`}>
          {p.options.map((o) => {
            const pct = total ? Math.round((o.count / total) * 100) : 0;
            const mine = p.myOptionIds.includes(o.id);
            return (
              <li key={o.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 break-words">
                    {mine && <Check className="size-4 shrink-0 text-primary-strong" aria-label={t("polls.voted")} />}
                    {o.text}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t("polls.voteCount", { count: o.count })} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-(--duration-base)",
                      mine ? "bg-primary" : "bg-primary/45",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {!p.anonymous && o.voters && o.voters.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">
                    {t("polls.voters", {
                      names: o.voters
                        .map((v) => v.name)
                        .filter(Boolean)
                        .join(", "),
                    })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t("polls.votes", { count: p.votersCount })}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {choosing && (
            <>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </Button>
              )}
              <Button size="sm" loading={busy === "vote"} disabled={!choice.length} onClick={() => void vote()}>
                {t("polls.vote")}
              </Button>
            </>
          )}
          {canVote && voted && !editing && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setChoice(p.myOptionIds);
                  setEditing(true);
                }}
              >
                {t("polls.changeVote")}
              </Button>
              <Button variant="ghost" size="sm" loading={busy === "retract"} onClick={() => void retract()}>
                {t("polls.retract")}
              </Button>
            </>
          )}
          {canClose && (
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirmClose(true)}>
              {t("polls.close")}
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t("polls.closeConfirm")}
        confirmLabel={t("polls.close")}
        onConfirm={async () => {
          try {
            setPoll(await pollApi.close(p._id));
          } catch (error) {
            handle(error);
          }
        }}
      />
    </div>
  );
}
