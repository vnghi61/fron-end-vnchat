import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { Conversation } from "@/core/api/types";
import { useLimits } from "@/core/auth/session";
import { uuid } from "@/core/lib/id";
import { applyServerErrors } from "@/core/lib/forms";
import { Button, Checkbox, Dialog, DialogContent, Field, IconButton, Input } from "@/core/ui/components";
import { FormAlert } from "@/features/auth/AuthLayout";
import { toLocalInput } from "@/features/reminders/api";
import { createPoll } from "./api";

// POST /api/conversations/:id/polls {question ≤300, options 2..limits.pollMaxOptions (≤200 ký tự), multiple, anonymous, closesAt?}
const schema = (max: number) =>
  z.object({
    question: z.string().trim().min(1, "polls.questionRequired").max(300),
    options: z
      .array(z.object({ text: z.string().trim().min(1, "polls.optionRequired").max(200) }))
      .min(2, "polls.minOptions")
      .max(max, "polls.maxOptions"),
    multiple: z.boolean(),
    anonymous: z.boolean(),
    closesAt: z.string(),
  });
type Values = z.infer<ReturnType<typeof schema>>;

export function CreatePollDialog({ conversation: c, onClose }: { conversation: Conversation; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const max = useLimits()?.pollMaxOptions ?? 10;
  const [formError, setFormError] = useState<string | null>(null);
  const [clientMsgId] = useState(uuid);
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema(max)),
    defaultValues: {
      question: "",
      options: [{ text: "" }, { text: "" }],
      multiple: false,
      anonymous: false,
      closesAt: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "options" });
  const msg = (m?: string) => (m ? t(m as "polls.minOptions", { count: max }) : undefined);

  const submit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await createPoll(qc, c._id, {
        question: v.question,
        options: v.options.map((o) => o.text),
        multiple: v.multiple,
        anonymous: v.anonymous,
        closesAt: v.closesAt ? new Date(v.closesAt).toISOString() : undefined,
        clientMsgId, // gửi lại sau lỗi mạng không tạo trùng bình chọn
      });
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["question", "options", "closesAt"]));
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t("polls.create")}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="create-poll" loading={isSubmitting}>
              {t("polls.submit")}
            </Button>
          </>
        }
      >
        <form id="create-poll" noValidate className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <FormAlert message={formError} />
          <Field label={t("polls.question")} error={msg(errors.question?.message)}>
            <Input autoFocus maxLength={300} autoComplete="off" {...register("question")} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">{t("composerMore.poll")}</legend>
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-1">
                <Field
                  label={<span className="sr-only">{t("polls.option", { n: i + 1 })}</span>}
                  error={msg(errors.options?.[i]?.text?.message)}
                  className="flex-1 gap-0"
                >
                  <Input
                    placeholder={t("polls.option", { n: i + 1 })}
                    maxLength={200}
                    autoComplete="off"
                    {...register(`options.${i}.text`)}
                  />
                </Field>
                {fields.length > 2 && (
                  <IconButton
                    label={t("polls.removeOption", { n: i + 1 })}
                    icon={<X />}
                    onClick={() => remove(i)}
                    tooltip={false}
                  />
                )}
              </div>
            ))}
            {errors.options?.root?.message && <p className="text-sm text-danger">{msg(errors.options.root.message)}</p>}
            {errors.options?.message && <p className="text-sm text-danger">{msg(errors.options.message)}</p>}
            {fields.length < max && (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => append({ text: "" })}>
                <Plus aria-hidden="true" />
                {t("polls.addOption")}
              </Button>
            )}
          </fieldset>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={watch("multiple")} onCheckedChange={(v) => setValue("multiple", v === true)} />
            {t("polls.multiple")}
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={watch("anonymous")} onCheckedChange={(v) => setValue("anonymous", v === true)} />
            {t("polls.anonymous")}
          </label>
          <Field label={t("polls.closesAt")} optional={t("common.optional")} error={msg(errors.closesAt?.message)}>
            <Input type="datetime-local" min={toLocalInput(new Date(Date.now() + 60_000))} {...register("closesAt")} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
