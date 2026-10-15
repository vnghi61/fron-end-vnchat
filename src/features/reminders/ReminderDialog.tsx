import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, addHours, addMinutes, setHours, startOfDay } from "date-fns";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { Message, Reminder } from "@/core/api/types";
import { applyServerErrors } from "@/core/lib/forms";
import { formatFull } from "@/core/lib/time";
import { Button, Dialog, DialogContent, Field, Input, Textarea } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { FormAlert } from "@/features/auth/AuthLayout";
import { previewOf } from "@/features/messages/api";
import { applyReminder, localTimezone, reminderApi, toLocalInput, toOffsetISO } from "./api";

// Tạo / sửa nhắc việc (màn 13). Server: note 1..1000, remindAt ISO có offset trong [now+30s, now+1 năm].
// Ở client kiểm tra từ 1 phút để còn thời gian gửi request.
const MIN_LEAD_MS = 60_000;
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const schema = z.object({
  note: z.string().trim().min(1, "reminders.noteRequired").max(1000),
  when: z.string().refine((v) => {
    const at = new Date(v).getTime();
    return Number.isFinite(at) && at >= Date.now() + MIN_LEAD_MS && at <= Date.now() + MAX_AHEAD_MS;
  }, "reminders.range"),
});
type Values = z.infer<typeof schema>;

const quickPicks = () => {
  const now = new Date();
  return [
    { key: "m20", at: addMinutes(now, 20) },
    { key: "h1", at: addHours(now, 1) },
    { key: "h3", at: addHours(now, 3) },
    { key: "tomorrow", at: setHours(startOfDay(addDays(now, 1)), 9) },
  ] as const;
};

export function ReminderDialog({
  message,
  reminder,
  onClose,
}: {
  message?: Message | null;
  reminder?: Reminder;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const tz = reminder?.timezone ?? localTimezone();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      note: reminder?.note ?? (message ? previewOf(message).slice(0, 1000) : ""),
      when: toLocalInput(reminder ? new Date(reminder.remindAt) : addHours(new Date(), 1)),
    },
  });
  const msg = (m?: string) => (m ? t(m as "reminders.range") : undefined);

  const submit = handleSubmit(async (v) => {
    setFormError(null);
    const remindAt = toOffsetISO(new Date(v.when));
    try {
      const saved = reminder
        ? await reminderApi.update(reminder._id, { note: v.note, remindAt, timezone: localTimezone() })
        : await reminderApi.create({
            note: v.note,
            remindAt,
            timezone: localTimezone(),
            conversationId: message?.conversationId,
            messageId: message?._id,
          });
      applyReminder(qc, saved);
      toast.success(reminder ? t("reminders.saved") : t("reminders.created", { time: formatFull(saved.remindAt) }));
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["note"]));
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={reminder ? t("reminders.edit") : t("reminders.new")}
        description={message ? t("reminders.linked") : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="reminder-form" loading={isSubmitting}>
              {t("reminders.save")}
            </Button>
          </>
        }
      >
        <form id="reminder-form" noValidate className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <FormAlert message={formError} />
          <Field label={t("reminders.note")} error={msg(errors.note?.message)}>
            <Textarea rows={3} maxLength={1000} {...register("note")} />
          </Field>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("reminders.when")}>
            {quickPicks().map((q) => (
              <Button
                key={q.key}
                variant="secondary"
                size="sm"
                onClick={() => setValue("when", toLocalInput(q.at), { shouldValidate: true, shouldDirty: true })}
              >
                {t(`reminders.quick.${q.key}`)}
              </Button>
            ))}
          </div>
          <Field label={t("reminders.when")} hint={t("reminders.timezone", { tz })} error={msg(errors.when?.message)}>
            <Input
              type="datetime-local"
              min={toLocalInput(new Date(Date.now() + MIN_LEAD_MS))}
              max={toLocalInput(new Date(Date.now() + MAX_AHEAD_MS))}
              {...register("when")}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
