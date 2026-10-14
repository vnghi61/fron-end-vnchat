import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation, Id } from "@/core/api/types";
import { useLimits, useSession } from "@/core/auth/session";
import { ApiError } from "@/core/api/errors";
import { errorMessage } from "@/core/i18n";
import { Avatar, Button, Checkbox, Dialog, DialogContent, Input } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { useInbox } from "@/features/conversations/api";
import { conversationAvatar, conversationTitle } from "@/features/conversations/display";
import { forwardMessage } from "./api";
import { useMessageDialogs } from "./dialog-store";

const EMPTY: Record<string, string> = {};
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Chuyển tiếp một tin tới ≤ forwardMaxTargets hội thoại; báo kết quả từng đích (results[].error). */
export function ForwardDialog() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const message = useMessageDialogs((s) => s.forward);
  const close = useMessageDialogs((s) => s.openForward);
  const limits = useLimits();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const nicknames = useSession((s) => s.bootstrap?.nicknames ?? EMPTY);
  const inbox = useInbox("inbox", !!message);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Id[]>([]);
  const [busy, setBusy] = useState(false);
  const max = limits?.forwardMaxTargets ?? 10;

  const options = useMemo(() => {
    const all = (inbox.data?.pages.flatMap((p) => p.items) ?? []).filter(
      (c) => c.kind !== "support" || c.myRole !== null,
    );
    const needle = fold(q.trim());
    return all
      .map((c) => ({ conv: c, title: conversationTitle(c, meId, nicknames) }))
      .filter((o) => !needle || fold(o.title).includes(needle));
  }, [inbox.data, q, meId, nicknames]);

  const onOpenChange = (open: boolean) => {
    if (open) return;
    close(null);
    setSelected([]);
    setQ("");
  };

  const submit = async () => {
    if (!message || !selected.length) return;
    setBusy(true);
    try {
      const targets = selected
        .map((id) => options.find((o) => o.conv._id === id)?.conv)
        .filter((c): c is Conversation => !!c);
      const results = await forwardMessage(qc, message, targets);
      const ok = results.filter((r) => r.message).length;
      if (ok === results.length) toast.success(t("forward.done", { count: ok }));
      else {
        const firstError = results.find((r) => r.error)?.error;
        toast.error(
          `${t("forward.partial", { ok, total: results.length })}${firstError ? ` – ${errorMessage(new ApiError({ status: 400, code: firstError.code, message: firstError.message }))}` : ""}`,
        );
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!message} onOpenChange={onOpenChange}>
      {message && (
        <DialogContent
          title={t("forward.title")}
          description={t("forward.limit", { count: max })}
          className="h-[min(600px,calc(var(--app-height,100dvh)-2rem))]"
          footer={
            <Button onClick={() => void submit()} loading={busy} disabled={!selected.length}>
              {t("forward.send", { count: selected.length })}
            </Button>
          }
        >
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("forward.search")}
                aria-label={t("forward.search")}
                className="pl-9"
              />
            </div>
            <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
              {options.map(({ conv, title }) => {
                const checked = selected.includes(conv._id);
                const full = !checked && selected.length >= max;
                return (
                  <li key={conv._id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted has-disabled:cursor-not-allowed has-disabled:opacity-50">
                      <Checkbox
                        checked={checked}
                        disabled={full}
                        aria-label={title}
                        onCheckedChange={(v) =>
                          setSelected((s) => (v === true ? [...s, conv._id] : s.filter((id) => id !== conv._id)))
                        }
                      />
                      <Avatar src={conversationAvatar(conv, meId)} name={title} size="sm" />
                      <span className="truncate text-sm font-medium">{title}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
