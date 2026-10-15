import { useQueryClient } from "@tanstack/react-query";
import { Star, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "@/core/api/types";
import { formatFull } from "@/core/lib/time";
import { Avatar, Badge, Input } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { setSupportTags } from "@/features/support/api";
import { StatusBadge } from "./StatusBadge";

/** Chi tiết yêu cầu (màn 18): khách, thông tin từ trang, người phụ trách, mốc thời gian, đánh giá, tag. */
export function TicketInfo({ conversation: c, canEdit }: { conversation: Conversation; canEdit: boolean }) {
  const { t } = useTranslation();
  const support = c.support;
  if (!support) return null;
  const customer = support.customer;
  const meta = Object.entries(support.meta ?? {});
  return (
    <div className="flex flex-col gap-5 p-4">
      <section className="flex items-center gap-3">
        <Avatar src={customer?.profileImage} name={customer?.name || c.title} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{customer?.name || c.title}</p>
          <p className="text-sm text-muted-foreground">
            {customer?.kind === "visitor" ? t("agent.visitor") : t("agent.member")}
          </p>
        </div>
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("agent.status")}</dt>
        <dd>
          <StatusBadge status={support.status} />
        </dd>
        {customer?.contactEmail && (
          <>
            <dt className="text-muted-foreground">{t("agent.contact")}</dt>
            <dd className="min-w-0 break-all">
              <a
                href={`mailto:${customer.contactEmail}`}
                className="text-primary-strong underline-offset-4 hover:underline"
              >
                {customer.contactEmail}
              </a>
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">{t("agent.assignee")}</dt>
        <dd>{support.assignee?.name ?? t("agent.unassigned")}</dd>
        <dt className="text-muted-foreground">{t("agent.createdAt")}</dt>
        <dd>{formatFull(c.createdAt)}</dd>
        {support.assignedAt && (
          <>
            <dt className="text-muted-foreground">{t("agent.assignedAt")}</dt>
            <dd>{formatFull(support.assignedAt)}</dd>
          </>
        )}
        {support.closedAt && (
          <>
            <dt className="text-muted-foreground">{t("agent.closedAt")}</dt>
            <dd>{formatFull(support.closedAt)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t("agent.rating")}</dt>
        <dd>
          {support.rating ? (
            <span className="inline-flex items-center gap-1">
              <Star className="size-4 fill-warning text-warning" aria-hidden="true" />
              {support.rating}/5
            </span>
          ) : (
            t("agent.noRatingYet")
          )}
          {support.ratingNote && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{support.ratingNote}</p>}
        </dd>
      </dl>

      {meta.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-sm font-medium">{t("agent.meta")}</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {meta.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="min-w-0 break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <TagEditor conversation={c} canEdit={canEdit} />
    </div>
  );
}

function TagEditor({ conversation: c, canEdit }: { conversation: Conversation; canEdit: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const tags = c.support?.tags ?? [];
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (next: string[]) => {
    setBusy(true);
    try {
      await setSupportTags(qc, c._id, next);
      toast.success(t("agent.tagsSaved"));
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="mb-1.5 text-sm font-medium">{t("agent.tags")}</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} className="gap-1 pr-1">
            #{tag}
            {canEdit && (
              <button
                type="button"
                disabled={busy}
                aria-label={t("agent.removeTag", { tag })}
                onClick={() => void save(tags.filter((x) => x !== tag))}
                className="flex size-5 items-center justify-center rounded-full hover:bg-surface"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {canEdit && (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            const tag = draft.trim().toLowerCase();
            if (!tag || tags.includes(tag)) return setDraft("");
            setDraft("");
            void save([...tags, tag]);
          }}
        >
          <Input
            value={draft}
            maxLength={32}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("agent.tagPlaceholder")}
            aria-label={t("agent.tagPlaceholder")}
          />
        </form>
      )}
    </section>
  );
}
