import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { Conversation, HistoryVisibility } from "@/core/api/types";
import { useFeatures } from "@/core/auth/session";
import { applyServerErrors } from "@/core/lib/forms";
import { Avatar, Button, Dialog, DialogContent, Field, Input, Select } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { FormAlert } from "@/features/auth/AuthLayout";
import { applyGroup, groupApi } from "@/features/groups/api";
import { readImageAsDataUri } from "@/features/shared/files";

// PATCH /api/conversations/:id {title?, avatarUrl? ("" = xoá), avatar? (data URI – server upload), historyVisibility?}
// Chỉ owner/admin của nhóm. Mỗi thay đổi sinh một tin system (đổi tên, đổi ảnh, đổi lịch sử).
const schema = z.object({
  title: z.string().trim().min(1, "newChat.groupNameRequired").max(100),
  avatar: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("data:image/"), "settings.avatarHint"),
  historyVisibility: z.enum(["all", "since_join"]),
});
type Values = z.infer<typeof schema>;

export function EditGroupDialog({ conversation: c, onClose }: { conversation: Conversation; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const features = useFeatures();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: c.title, avatar: c.avatarUrl, historyVisibility: c.historyVisibility ?? "all" },
  });
  const avatar = watch("avatar");
  const msg = (m?: string) => (m ? t(m as "details.groupName") : undefined);

  const submit = handleSubmit(async (v) => {
    setFormError(null);
    const body: Parameters<typeof groupApi.update>[1] = {};
    if (v.title !== c.title) body.title = v.title;
    if (v.avatar !== c.avatarUrl) {
      if (v.avatar.startsWith("data:")) body.avatar = v.avatar;
      else body.avatarUrl = v.avatar;
    }
    if (v.historyVisibility !== (c.historyVisibility ?? "all"))
      body.historyVisibility = v.historyVisibility as HistoryVisibility;
    try {
      applyGroup(qc, await groupApi.update(c._id, body));
      toast.success(t("details.saved"));
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["title", "historyVisibility"]));
    }
  });

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setValue("avatar", await readImageAsDataUri(file, 5 * 1024 * 1024), { shouldDirty: true });
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t("details.edit")}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="edit-group" loading={isSubmitting} disabled={!isDirty}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <form id="edit-group" noValidate className="flex flex-col gap-5" onSubmit={(e) => void submit(e)}>
          <FormAlert message={formError} />
          <div className="flex items-center gap-4">
            <Avatar src={avatar || null} name={watch("title") || c.title} size="lg" />
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
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <Camera aria-hidden="true" />
                    {t("details.avatarUpload")}
                  </Button>
                </>
              )}
              {avatar && (
                <Button variant="danger-ghost" size="sm" onClick={() => setValue("avatar", "", { shouldDirty: true })}>
                  <Trash2 aria-hidden="true" />
                  {t("settings.avatarRemove")}
                </Button>
              )}
            </div>
          </div>
          <Field label={t("details.groupName")} error={msg(errors.title?.message)}>
            <Input autoComplete="off" maxLength={100} {...register("title")} />
          </Field>
          {!avatar.startsWith("data:") && (
            <Field label={t("details.avatarUrl")} hint={t("settings.avatarHint")} error={msg(errors.avatar?.message)}>
              <Input type="url" inputMode="url" placeholder="https://" {...register("avatar")} />
            </Field>
          )}
          <Field label={t("details.historyVisibility")} error={msg(errors.historyVisibility?.message)}>
            <Select {...register("historyVisibility")}>
              <option value="all">{t("newChat.historyAll")}</option>
              <option value="since_join">{t("newChat.historySinceJoin")}</option>
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
