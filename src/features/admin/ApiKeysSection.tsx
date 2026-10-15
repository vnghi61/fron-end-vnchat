import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { qk } from "@/core/api/query";
import type { ApiKey } from "@/core/api/types";
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
  Input,
  Skeleton,
} from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { FormAlert } from "@/features/auth/AuthLayout";
import { toOffsetISO } from "@/features/reminders/api";
import { AdminError, AdminPage, SecretOnceDialog } from "./AdminPage";
import { adminApi, useApiKeys } from "./api";

type KeyList = { items: ApiKey[]; scopes: string[] };

/** API key đối tác (màn 23): tạo (key `ck_…` hiện một lần), thu hồi. Mỗi key có một bot user hiển thị trong chat. */
export function ApiKeysSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useApiKeys();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  return (
    <AdminPage
      title={t("admin.nav.apiKeys")}
      actions={
        query.data && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            {t("admin.apiKeys.create")}
          </Button>
        )
      }
    >
      {query.isPending ? (
        <Skeleton className="h-32 w-full rounded-md" />
      ) : query.isError ? (
        <AdminError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={<KeyRound />} title={t("admin.apiKeys.empty")} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
          {query.data.items.map((k) => (
            <li key={k._id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="truncate">{k.name}</span>
                  <Badge tone={k.status === "active" ? "success" : "neutral"}>
                    {t(`admin.apiKeys.status.${k.status}`)}
                  </Badge>
                </p>
                <p className="font-mono text-xs text-muted-foreground">{k.prefix}…</p>
                <p className="text-xs text-muted-foreground">
                  {k.lastUsedAt
                    ? t("admin.apiKeys.lastUsed", { time: formatRelative(k.lastUsedAt) })
                    : t("admin.apiKeys.neverUsed")}{" "}
                  ·{" "}
                  {k.expiresAt
                    ? `${t("admin.apiKeys.expiresAt")} ${formatFull(k.expiresAt)}`
                    : t("admin.apiKeys.never")}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {k.scopes.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              </div>
              {k.status === "active" && (
                <Button variant="danger-ghost" size="sm" onClick={() => setRevoking(k)}>
                  {t("admin.apiKeys.revoke")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {creating && query.data && (
        <CreateKeyDialog
          scopes={query.data.scopes}
          onClose={() => setCreating(false)}
          onCreated={(key, raw) => {
            qc.setQueryData<KeyList>(qk.admin("api-keys"), (d) => (d ? { ...d, items: [key, ...d.items] } : d));
            setCreating(false);
            setSecret(raw);
          }}
        />
      )}
      {secret && <SecretOnceDialog label={t("admin.nav.apiKeys")} secret={secret} onClose={() => setSecret(null)} />}
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t("admin.apiKeys.revokeConfirm", { name: revoking?.name ?? "" })}
        description={t("admin.apiKeys.revokeBody")}
        confirmLabel={t("admin.apiKeys.revoke")}
        onConfirm={async () => {
          if (!revoking) return;
          try {
            await adminApi.revokeApiKey(revoking._id);
            qc.setQueryData<KeyList>(qk.admin("api-keys"), (d) =>
              d
                ? {
                    ...d,
                    items: d.items.map((k) =>
                      k._id === revoking._id ? { ...k, status: "revoked", revokedAt: new Date().toISOString() } : k,
                    ),
                  }
                : d,
            );
            toast.success(t("admin.apiKeys.revoked"));
          } catch (error) {
            toast.error(error);
          }
        }}
      />
    </AdminPage>
  );
}

const keySchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.string()).min(1, "admin.apiKeys.scopesRequired"),
  expiresAt: z.string(),
});

function CreateKeyDialog({
  scopes,
  onClose,
  onCreated,
}: {
  scopes: string[];
  onClose: () => void;
  onCreated: (key: ApiKey, raw: string) => void;
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
  } = useForm<z.infer<typeof keySchema>>({
    resolver: zodResolver(keySchema),
    defaultValues: { name: "", scopes: [], expiresAt: "" },
  });
  const selected = watch("scopes");
  const submit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const res = await adminApi.createApiKey({
        name: v.name,
        scopes: v.scopes,
        expiresAt: v.expiresAt ? toOffsetISO(new Date(`${v.expiresAt}T23:59:59`)) : undefined,
      });
      toast.success(t("admin.apiKeys.created"));
      onCreated(res.apiKey, res.key);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["name", "scopes", "expiresAt"]));
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t("admin.apiKeys.create")}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="api-key-form" loading={isSubmitting}>
              {t("admin.apiKeys.create")}
            </Button>
          </>
        }
      >
        <form id="api-key-form" noValidate className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <FormAlert message={formError} />
          <Field label={t("admin.apiKeys.name")}>
            <Input maxLength={100} autoComplete="off" {...register("name")} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{t("admin.apiKeys.scopes")}</legend>
            <div className="flex flex-col gap-2">
              {scopes.map((s) => (
                <label key={s} className="flex items-center gap-2 font-mono text-sm">
                  <Checkbox
                    checked={selected.includes(s)}
                    onCheckedChange={(v) =>
                      setValue("scopes", v === true ? [...selected, s] : selected.filter((x) => x !== s), {
                        shouldValidate: true,
                      })
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
            {errors.scopes?.message && (
              <p className="mt-1 text-sm text-danger">{t(errors.scopes.message as "admin.apiKeys.scopesRequired")}</p>
            )}
          </fieldset>
          <Field label={t("admin.apiKeys.expiresAt")} optional={t("common.optional")}>
            <Input type="date" min={new Date().toISOString().slice(0, 10)} {...register("expiresAt")} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
