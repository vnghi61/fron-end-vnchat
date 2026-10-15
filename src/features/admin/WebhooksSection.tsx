import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { History, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { qk } from "@/core/api/query";
import type { Webhook, WebhookDelivery } from "@/core/api/types";
import { applyServerErrors } from "@/core/lib/forms";
import { formatFull, formatRelative } from "@/core/lib/time";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  IconButton,
  Input,
  SheetContent,
  Skeleton,
  Switch,
} from "@/core/ui/components";
import { ActionDropdown } from "@/core/ui/components/action-menu";
import { toast } from "@/core/ui/toast";
import { FormAlert } from "@/features/auth/AuthLayout";
import { AdminError, AdminPage, SecretOnceDialog } from "./AdminPage";
import { adminApi, useDeliveries, useWebhooks, type WebhookBody } from "./api";

type WebhookList = { items: Webhook[]; events: string[] };

/** Webhook (màn 22): danh sách, tạo (secret hiện một lần), sửa, bật/tắt, xoá, lịch sử gửi + gửi lại. */
export function WebhooksSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useWebhooks();
  const [editing, setEditing] = useState<Webhook | "new" | null>(null);
  const [deleting, setDeleting] = useState<Webhook | null>(null);
  const [history, setHistory] = useState<Webhook | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const replace = (hook: Webhook) =>
    qc.setQueryData<WebhookList>(qk.admin("webhooks"), (d) =>
      d
        ? {
            ...d,
            items: d.items.some((w) => w._id === hook._id)
              ? d.items.map((w) => (w._id === hook._id ? hook : w))
              : [hook, ...d.items],
          }
        : d,
    );

  const toggle = async (w: Webhook, enabled: boolean) => {
    try {
      // PUT cần đủ name/url/events (schema backend) – không gửi secret để giữ nguyên
      replace(await adminApi.updateWebhook(w._id, { name: w.name, url: w.url, events: w.events, enabled }));
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <AdminPage
      title={t("admin.nav.webhooks")}
      actions={
        query.data && (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            {t("admin.webhooks.create")}
          </Button>
        )
      }
    >
      {query.isPending ? (
        <Skeleton className="h-32 w-full rounded-md" />
      ) : query.isError ? (
        <AdminError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={<WebhookIcon />} title={t("admin.webhooks.empty")} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
          {query.data.items.map((w) => (
            <li key={w._id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{w.url}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {w.events.map((e) => (
                    <Badge key={e}>{e}</Badge>
                  ))}
                </div>
              </div>
              <Switch
                aria-label={t("admin.webhooks.toggle", { name: w.name })}
                checked={w.enabled}
                onCheckedChange={(v) => void toggle(w, v)}
                className="mt-1"
              />
              <ActionDropdown
                items={[
                  {
                    key: "history",
                    label: t("admin.webhooks.deliveries"),
                    icon: <History />,
                    onSelect: () => setHistory(w),
                  },
                  { key: "edit", label: t("admin.webhooks.edit"), icon: <Pencil />, onSelect: () => setEditing(w) },
                  { type: "separator", key: "sep" },
                  {
                    key: "delete",
                    label: t("common.delete"),
                    icon: <Trash2 />,
                    destructive: true,
                    onSelect: () => setDeleting(w),
                  },
                ]}
                trigger={
                  <IconButton
                    label={t("admin.webhooks.actions", { name: w.name })}
                    icon={<MoreHorizontal />}
                    size="sm"
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}

      {editing && query.data && (
        <WebhookDialog
          webhook={editing === "new" ? null : editing}
          events={query.data.events}
          onClose={() => setEditing(null)}
          onSaved={(hook, newSecret) => {
            replace(hook);
            setEditing(null);
            if (newSecret) setSecret(newSecret);
          }}
        />
      )}
      {secret && (
        <SecretOnceDialog label={t("admin.webhooks.secret")} secret={secret} onClose={() => setSecret(null)} />
      )}
      {history && <DeliveriesSheet webhook={history} onClose={() => setHistory(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("admin.webhooks.deleteConfirm", { name: deleting?.name ?? "" })}
        description={t("admin.webhooks.deleteBody")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await adminApi.deleteWebhook(deleting._id);
            qc.setQueryData<WebhookList>(qk.admin("webhooks"), (d) =>
              d ? { ...d, items: d.items.filter((w) => w._id !== deleting._id) } : d,
            );
            toast.success(t("admin.webhooks.deleted"));
          } catch (error) {
            toast.error(error);
          }
        }}
      />
    </AdminPage>
  );
}

const webhookSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z
    .string()
    .trim()
    .regex(/^https?:\/\/\S+$/i, "admin.webhooks.urlRequired")
    .max(2000),
  events: z.array(z.string()).min(1, "admin.webhooks.eventsRequired"),
  secret: z.union([z.literal(""), z.string().min(16).max(200)]),
});
type WebhookValues = z.infer<typeof webhookSchema>;

function WebhookDialog({
  webhook,
  events,
  onClose,
  onSaved,
}: {
  webhook: Webhook | null;
  events: string[];
  onClose: () => void;
  onSaved: (hook: Webhook, secret?: string) => void;
}) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WebhookValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { name: webhook?.name ?? "", url: webhook?.url ?? "", events: webhook?.events ?? ["*"], secret: "" },
  });
  const selected = watch("events");
  const all = selected.includes("*");
  const toggle = (e: string, on: boolean) =>
    setValue(
      "events",
      e === "*" ? (on ? ["*"] : []) : on ? [...selected.filter((x) => x !== "*"), e] : selected.filter((x) => x !== e),
      {
        shouldValidate: true,
      },
    );
  const msg = (m?: string) => (m ? t(m as "admin.webhooks.urlRequired") : undefined);

  const submit = handleSubmit(async (v) => {
    setFormError(null);
    const body: WebhookBody = { name: v.name, url: v.url, events: v.events, ...(v.secret ? { secret: v.secret } : {}) };
    try {
      if (webhook) onSaved(await adminApi.updateWebhook(webhook._id, { ...body, enabled: webhook.enabled }));
      else {
        const res = await adminApi.createWebhook(body);
        toast.success(t("admin.webhooks.created"));
        onSaved(res.webhook, res.secret);
      }
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["name", "url", "events", "secret"]));
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={webhook ? t("admin.webhooks.edit") : t("admin.webhooks.create")}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="webhook-form" loading={isSubmitting}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <form id="webhook-form" noValidate className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <FormAlert message={formError} />
          <Field label={t("admin.webhooks.name")} error={msg(errors.name?.message)}>
            <Input maxLength={100} autoComplete="off" {...register("name")} />
          </Field>
          <Field label={t("admin.webhooks.url")} error={msg(errors.url?.message)}>
            <Input type="url" inputMode="url" placeholder="https://" {...register("url")} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{t("admin.webhooks.events")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                <Checkbox checked={all} onCheckedChange={(v) => toggle("*", v === true)} />
                {t("admin.webhooks.allEvents")}
              </label>
              {events.map((e) => (
                <label key={e} className="flex items-center gap-2 font-mono text-xs">
                  <Checkbox
                    checked={all || selected.includes(e)}
                    disabled={all}
                    onCheckedChange={(v) => toggle(e, v === true)}
                  />
                  {e}
                </label>
              ))}
            </div>
            {errors.events?.message && <p className="mt-1 text-sm text-danger">{msg(errors.events.message)}</p>}
          </fieldset>
          <Field
            label={t("admin.webhooks.secret")}
            optional={t("common.optional")}
            hint={t("admin.webhooks.secretHint")}
            error={errors.secret ? t("admin.webhooks.secretHint") : undefined}
          >
            <Input type="password" autoComplete="new-password" {...register("secret")} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const deliveryTone = { pending: "warning", delivered: "success", failed: "danger" } as const;

function DeliveriesSheet({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const { t } = useTranslation();
  const query = useDeliveries(webhook._id);
  const [busy, setBusy] = useState<string | null>(null);
  const redeliver = async (d: WebhookDelivery) => {
    setBusy(d._id);
    try {
      await adminApi.redeliver(d._id);
      toast.success(t("admin.webhooks.redelivered"));
      void query.refetch();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={t("admin.webhooks.deliveriesOf", { name: webhook.name })} className="max-w-md">
        {query.isPending ? (
          <Skeleton className="m-4 h-24" />
        ) : query.isError ? (
          <AdminError error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState title={t("admin.webhooks.noDeliveries")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {query.data.map((d) => (
              <li key={d._id} className="flex items-start gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{d.event}</span>
                    <Badge tone={deliveryTone[d.status]}>{t(`admin.webhooks.status.${d.status}`)}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={d.createdAt} title={formatFull(d.createdAt)}>
                      {formatRelative(d.createdAt)}
                    </time>{" "}
                    · {t("admin.webhooks.attempts", { count: d.attempts })}
                    {d.lastStatusCode ? ` · HTTP ${d.lastStatusCode}` : ""}
                  </p>
                  {d.lastError && <p className="mt-1 break-words text-xs text-danger">{d.lastError}</p>}
                </div>
                {d.status === "failed" && (
                  <Button variant="secondary" size="sm" loading={busy === d._id} onClick={() => void redeliver(d)}>
                    <RotateCcw aria-hidden="true" />
                    {t("admin.webhooks.redeliver")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Dialog>
  );
}
