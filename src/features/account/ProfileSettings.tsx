import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { api } from "@/core/api/http";
import type { UserProfile } from "@/core/api/types";
import { useFeatures, useMe, useSession } from "@/core/auth/session";
import { dateLocale } from "@/core/i18n";
import { applyServerErrors } from "@/core/lib/forms";
import { Avatar, Badge, Button, Field, Input } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { FormAlert } from "@/features/auth/AuthLayout";
import { readImageAsDataUri } from "@/features/shared/files";
import { SettingsPage } from "./SettingsLayout";

// PATCH /api/me {name?, profileImage?}: profileImage = URL https, data URI ảnh (server upload lên Cloudinary –
// chỉ khi features.uploads), hoặc "" để xoá.
const schema = z.object({
  name: z.string().trim().min(1, "auth.nameRequired").max(100, "auth.nameTooLong"),
  profileImage: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("data:image/"), "settings.avatarHint"),
});
type Values = z.infer<typeof schema>;

export function ProfileSettings() {
  const { t } = useTranslation();
  const me = useMe();
  const features = useFeatures();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: me?.name ?? "", profileImage: me?.profileImage ?? "" },
  });

  const save = useMutation({
    mutationFn: (body: Values) => api.patch<UserProfile>("/api/me", body),
    onSuccess: (profile) => {
      useSession.getState().setMe(profile);
      reset({ name: profile.name, profileImage: profile.profileImage });
      toast.success(t("settings.profileSaved"));
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, ["name", "profileImage"])),
  });

  if (!me) return null;
  const preview = watch("profileImage");
  const msg = (m?: string) => (m ? t(m as "auth.nameRequired") : undefined);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setValue("profileImage", await readImageAsDataUri(file, 5 * 1024 * 1024), { shouldDirty: true });
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <SettingsPage title={t("settings.profile")}>
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          save.mutate(values);
        })}
      >
        <FormAlert message={formError} />
        <div className="flex items-center gap-4">
          <Avatar src={preview || null} name={watch("name") || me.name} size="xl" />
          <div className="flex flex-wrap gap-2">
            {features.uploads && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    void pickFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  <Camera aria-hidden="true" />
                  {t("settings.avatarUpload")}
                </Button>
              </>
            )}
            {preview && (
              <Button variant="danger-ghost" onClick={() => setValue("profileImage", "", { shouldDirty: true })}>
                <Trash2 aria-hidden="true" />
                {t("settings.avatarRemove")}
              </Button>
            )}
          </div>
        </div>

        <Field label={t("settings.displayName")} error={msg(errors.name?.message)}>
          <Input autoComplete="name" {...register("name")} />
        </Field>
        {!preview.startsWith("data:") && (
          <Field
            label={t("settings.avatarUrl")}
            hint={t("settings.avatarHint")}
            error={msg(errors.profileImage?.message)}
          >
            <Input type="url" inputMode="url" placeholder="https://" {...register("profileImage")} />
          </Field>
        )}

        <dl className="grid gap-3 rounded-md border border-border bg-surface p-4 text-sm sm:grid-cols-2">
          {me.email && (
            <div>
              <dt className="text-muted-foreground">{t("settings.email")}</dt>
              <dd className="font-medium">{me.email}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">{t("settings.memberSince")}</dt>
            <dd className="font-medium">{format(new Date(me.createdAt), "PPP", { locale: dateLocale() })}</dd>
          </div>
          {me.roles && me.roles.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t("settings.roles")}</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {me.roles.map((r) => (
                  <Badge key={r}>{r}</Badge>
                ))}
              </dd>
            </div>
          )}
        </dl>

        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </SettingsPage>
  );
}
