import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useFieldArray, useForm, type Control, type UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { qk } from "@/core/api/query";
import type { AdminSettings } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { cn } from "@/core/lib/cn";
import { brandTokens } from "@/core/ui/branding";
import { parseHex } from "@/core/ui/color";
import { Button, Field, IconButton, Input, Skeleton, Switch, Textarea } from "@/core/ui/components";
import { useTheme } from "@/core/ui/theme";
import { toast } from "@/core/ui/toast";
import { FormAlert } from "@/features/auth/AuthLayout";
import { AdminError, AdminPage } from "./AdminPage";
import { adminApi, useAdminSettings } from "./api";

// Cài đặt hệ thống (màn 21): mỗi thẻ lưu riêng phần của nó (PUT partial – backend merge branding/widget, thay toàn bộ
// commandRules/stickerPacks). Lưu xong tải lại bootstrap để app áp branding/lệnh mới ngay.

function useSave() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return async (patch: Partial<AdminSettings>) => {
    const res = await adminApi.saveSettings(patch);
    qc.setQueryData(qk.admin("settings"), res);
    void qc.invalidateQueries({ queryKey: qk.stickers });
    void useSession
      .getState()
      .refreshBootstrap()
      .catch(() => undefined);
    toast.success(t("admin.saved"));
  };
}

export function SettingsSection() {
  const { t } = useTranslation();
  const query = useAdminSettings();
  return (
    <AdminPage title={t("admin.nav.settings")}>
      {query.isPending ? (
        <div className="flex flex-col gap-4" aria-hidden="true">
          <Skeleton className="h-48 w-full rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
      ) : query.isError ? (
        <AdminError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="flex flex-col gap-5">
          <BrandingCard settings={query.data} />
          <WidgetCard settings={query.data} />
          <CommandsCard settings={query.data} />
          <StickersCard settings={query.data} />
        </div>
      )}
    </AdminPage>
  );
}

function Card({
  title,
  children,
  onSubmit,
  busy,
  dirty,
  error,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  busy: boolean;
  dirty: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-md border border-border bg-surface">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <h3 className="border-b border-border px-4 py-3 text-base font-semibold">{title}</h3>
        <div className="flex flex-col gap-4 p-4">
          <FormAlert message={error} />
          {children}
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button type="submit" loading={busy} disabled={!dirty}>
            {t("admin.settings.save")}
          </Button>
        </div>
      </form>
    </section>
  );
}

const httpsOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "settings.avatarHint");

// ---------- thương hiệu ----------

const brandingSchema = z.object({
  appName: z.string().trim().max(100),
  logoUrl: httpsOrEmpty,
  primaryColor: z
    .string()
    .trim()
    .refine((v) => v === "" || !!parseHex(v), "admin.settings.primaryHint"),
});

function BrandingCard({ settings }: { settings: AdminSettings }) {
  const { t } = useTranslation();
  const save = useSave();
  const resolved = useTheme((s) => s.resolved);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof brandingSchema>>({
    resolver: zodResolver(brandingSchema),
    values: settings.branding,
  });
  const { register, handleSubmit, watch, setValue, formState } = form;
  const color = watch("primaryColor");
  const tokens = brandTokens(color, resolved);
  const unusable = !!color && !!parseHex(color) && !tokens;
  const msg = (m?: string) => (m ? t(m as "admin.settings.primaryHint") : undefined);
  const preview = tokens
    ? ({ background: tokens["--primary"], color: tokens["--primary-foreground"] } as CSSProperties)
    : undefined;

  return (
    <Card
      title={t("admin.settings.branding")}
      busy={formState.isSubmitting}
      dirty={formState.isDirty}
      error={error}
      onSubmit={() =>
        void handleSubmit(async (v) => {
          setError(null);
          try {
            await save({ branding: v });
          } catch (e) {
            setError(errorMessage(e));
          }
        })()
      }
    >
      <Field label={t("admin.settings.appName")}>
        <Input maxLength={100} {...register("appName")} />
      </Field>
      <Field label={t("admin.settings.logoUrl")} error={msg(formState.errors.logoUrl?.message)}>
        <Input type="url" inputMode="url" placeholder="https://" {...register("logoUrl")} />
      </Field>
      <Field
        label={t("admin.settings.primaryColor")}
        hint={t("admin.settings.primaryHint")}
        error={msg(formState.errors.primaryColor?.message)}
      >
        <Input placeholder="#5865F2" maxLength={32} {...register("primaryColor")} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          aria-label={t("admin.settings.primaryColor")}
          value={parseHex(color) ? color : "#5865f2"}
          onChange={(e) => setValue("primaryColor", e.target.value, { shouldDirty: true, shouldValidate: true })}
          className="h-10 w-14 cursor-pointer rounded-sm border border-border bg-transparent"
        />
        <span className="text-sm text-muted-foreground">{t("admin.settings.preview")}</span>
        <span
          className={cn("rounded-sm px-4 py-2 text-sm font-medium", !preview && "bg-primary text-primary-foreground")}
          style={preview}
        >
          {watch("appName") || t("common.appName")}
        </span>
      </div>
      {unusable && (
        <p className="flex items-center gap-2 text-sm text-warning">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {t("admin.settings.contrastWarn")}
        </p>
      )}
    </Card>
  );
}

// ---------- widget ----------

function WidgetCard({ settings }: { settings: AdminSettings }) {
  const { t } = useTranslation();
  const save = useSave();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState } = useForm({ values: settings.widget });
  return (
    <Card
      title={t("admin.settings.widget")}
      busy={formState.isSubmitting}
      dirty={formState.isDirty}
      error={error}
      onSubmit={() =>
        void handleSubmit(async (v) => {
          setError(null);
          try {
            await save({ widget: v });
          } catch (e) {
            setError(errorMessage(e));
          }
        })()
      }
    >
      <label className="flex items-center justify-between gap-3 text-sm font-medium">
        {t("admin.settings.widgetEnabled")}
        <Switch checked={watch("enabled")} onCheckedChange={(v) => setValue("enabled", v, { shouldDirty: true })} />
      </label>
      <Field label={t("admin.settings.welcome")}>
        <Textarea rows={2} maxLength={1000} {...register("welcomeMessage")} />
      </Field>
    </Card>
  );
}

// ---------- lệnh ----------

const commandsSchema = z.object({
  commandRules: z.array(
    z.object({
      name: z
        .string()
        .trim()
        .regex(/^[a-z][a-z0-9_-]{0,31}$/, "admin.settings.commandInvalid"),
      description: z.string().trim().max(200),
      enabled: z.boolean(),
    }),
  ),
});

function CommandsCard({ settings }: { settings: AdminSettings }) {
  const { t } = useTranslation();
  const save = useSave();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, watch, setValue, formState } = useForm<z.infer<typeof commandsSchema>>({
    resolver: zodResolver(commandsSchema),
    values: { commandRules: settings.commandRules },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "commandRules" });
  return (
    <Card
      title={t("admin.settings.commands")}
      busy={formState.isSubmitting}
      dirty={formState.isDirty}
      error={error}
      onSubmit={() =>
        void handleSubmit(async (v) => {
          setError(null);
          try {
            await save({ commandRules: v.commandRules });
          } catch (e) {
            setError(errorMessage(e));
          }
        })()
      }
    >
      <ul className="flex flex-col gap-3">
        {fields.map((f, i) => {
          const err = formState.errors.commandRules?.[i]?.name?.message;
          return (
            <li key={f.id} className="grid items-start gap-2 sm:grid-cols-[10rem_1fr_auto_auto]">
              <Field
                label={t("admin.settings.commandName")}
                error={err ? t(err as "admin.settings.commandInvalid") : undefined}
              >
                <Input maxLength={32} autoComplete="off" {...register(`commandRules.${i}.name`)} />
              </Field>
              <Field label={t("admin.settings.commandDescription")}>
                <Input maxLength={200} {...register(`commandRules.${i}.description`)} />
              </Field>
              <label className="flex flex-col items-start gap-2 text-sm font-medium sm:pt-0">
                {t("admin.settings.commandEnabled")}
                <Switch
                  checked={watch(`commandRules.${i}.enabled`)}
                  onCheckedChange={(v) => setValue(`commandRules.${i}.enabled`, v, { shouldDirty: true })}
                />
              </label>
              <IconButton
                className="sm:mt-6"
                label={t("admin.settings.removeCommand", { name: watch(`commandRules.${i}.name`) })}
                icon={<Trash2 />}
                onClick={() => remove(i)}
                tooltip={false}
              />
            </li>
          );
        })}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => append({ name: "", description: "", enabled: true })}
      >
        <Plus aria-hidden="true" />
        {t("admin.settings.addCommand")}
      </Button>
    </Card>
  );
}

// ---------- sticker ----------

const stickersSchema = z.object({
  stickerPacks: z.array(
    z.object({
      id: z.string().trim().min(1).max(64),
      name: z.string().trim().max(100),
      stickers: z.array(
        z.object({
          id: z.string().trim().min(1).max(64),
          name: z.string().trim().max(100),
          emoji: z.string().max(16),
          url: httpsOrEmpty,
        }),
      ),
    }),
  ),
});
type StickerValues = z.infer<typeof stickersSchema>;

function StickersCard({ settings }: { settings: AdminSettings }) {
  const { t } = useTranslation();
  const save = useSave();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, watch, formState } = useForm<StickerValues>({
    resolver: zodResolver(stickersSchema),
    values: { stickerPacks: settings.stickerPacks },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "stickerPacks" });
  return (
    <Card
      title={t("admin.settings.stickers")}
      busy={formState.isSubmitting}
      dirty={formState.isDirty}
      error={error}
      onSubmit={() =>
        void handleSubmit(async (v) => {
          setError(null);
          try {
            await save({ stickerPacks: v.stickerPacks });
          } catch (e) {
            setError(errorMessage(e));
          }
        })()
      }
    >
      {fields.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.settings.noPacks")}</p>}
      {fields.map((f, i) => (
        <fieldset key={f.id} className="flex flex-col gap-3 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-medium">
            {watch(`stickerPacks.${i}.name`) || watch(`stickerPacks.${i}.id`) || "…"}
          </legend>
          <div className="grid items-start gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <Field label={t("admin.settings.packId")}>
              <Input maxLength={64} autoComplete="off" {...register(`stickerPacks.${i}.id`)} />
            </Field>
            <Field label={t("admin.settings.packName")}>
              <Input maxLength={100} {...register(`stickerPacks.${i}.name`)} />
            </Field>
            <IconButton
              className="sm:mt-6"
              label={t("admin.settings.removePack", {
                name: watch(`stickerPacks.${i}.name`) || watch(`stickerPacks.${i}.id`),
              })}
              icon={<Trash2 />}
              onClick={() => remove(i)}
              tooltip={false}
            />
          </div>
          <StickerRows control={control} register={register} pack={i} />
        </fieldset>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => append({ id: "", name: "", stickers: [] })}
      >
        <Plus aria-hidden="true" />
        {t("admin.settings.addPack")}
      </Button>
    </Card>
  );
}

function StickerRows({
  control,
  register,
  pack,
}: {
  control: Control<StickerValues>;
  register: UseFormRegister<StickerValues>;
  pack: number;
}) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control, name: `stickerPacks.${pack}.stickers` });
  return (
    <div className="flex flex-col gap-2">
      {fields.map((f, j) => (
        <div key={f.id} className="grid items-end gap-2 sm:grid-cols-[7rem_1fr_5rem_1.5fr_auto]">
          <Field label={t("admin.settings.stickerId")}>
            <Input maxLength={64} autoComplete="off" {...register(`stickerPacks.${pack}.stickers.${j}.id`)} />
          </Field>
          <Field label={t("admin.settings.stickerName")}>
            <Input maxLength={100} {...register(`stickerPacks.${pack}.stickers.${j}.name`)} />
          </Field>
          <Field label={t("admin.settings.stickerEmoji")}>
            <Input maxLength={16} {...register(`stickerPacks.${pack}.stickers.${j}.emoji`)} />
          </Field>
          <Field label={t("admin.settings.stickerUrl")}>
            <Input
              type="url"
              inputMode="url"
              placeholder="https://"
              {...register(`stickerPacks.${pack}.stickers.${j}.url`)}
            />
          </Field>
          <IconButton
            label={t("admin.settings.removeSticker", { name: f.name || f.id })}
            icon={<Trash2 />}
            onClick={() => remove(j)}
            tooltip={false}
          />
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => append({ id: "", name: "", emoji: "", url: "" })}
      >
        <Plus aria-hidden="true" />
        {t("admin.settings.addSticker")}
      </Button>
    </div>
  );
}
