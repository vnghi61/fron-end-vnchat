import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { isApiError } from "@/core/api/errors";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { applyServerErrors } from "@/core/lib/forms";
import { authBase } from "@/core/lib/navigation";
import { Button, Field, Input } from "@/core/ui/components";
import { AuthLayout, FormAlert } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";

// Ràng buộc khớp backend: name bắt buộc (≤100 – PATCH /api/me), email hợp lệ, password ≥ 6 (openapi signup).
const schema = z.object({
  name: z.string().trim().min(1, "auth.nameRequired").max(100, "auth.nameTooLong"),
  email: z.string().trim().email("auth.emailInvalid"),
  password: z.string().min(6, "auth.passwordMin"),
});
type Values = z.infer<typeof schema>;
type MsgKey = "auth.nameRequired" | "auth.nameTooLong" | "auth.emailInvalid" | "auth.passwordMin";

export function SignupPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "" } });

  useEffect(() => setFocus("name"), [setFocus]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await useSession.getState().signup(values);
    } catch (error) {
      // Email đã dùng: backend trả 400 + CHAT-409-000 → gắn vào ô email.
      if (isApiError(error, "CHAT-409-000")) {
        setError("email", { type: "server", message: errorMessage(error) });
        setFocus("email");
        return;
      }
      setFormError(applyServerErrors(error, setError, ["name", "email", "password"]));
    }
  });

  const msg = (m?: string) => (m ? (m.startsWith("auth.") ? t(m as MsgKey) : m) : undefined);
  const next = params.get("next");
  const base = authBase(useLocation().pathname);

  return (
    <AuthLayout
      title={t("auth.signupTitle")}
      subtitle={t("auth.signupSubtitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link
            to={next ? `${base}/login?next=${encodeURIComponent(next)}` : `${base}/login`}
            className="font-medium text-primary-strong hover:underline"
          >
            {t("auth.toLogin")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />
        <Field label={t("auth.name")} error={msg(errors.name?.message)}>
          <Input autoComplete="name" {...register("name")} />
        </Field>
        <Field label={t("auth.email")} error={msg(errors.email?.message)}>
          <Input type="email" autoComplete="email" inputMode="email" {...register("email")} />
        </Field>
        <Field label={t("auth.password")} hint={t("auth.passwordMin")} error={msg(errors.password?.message)}>
          <PasswordInput autoComplete="new-password" {...register("password")} />
        </Field>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          {isSubmitting ? t("auth.submitting") : t("auth.submitSignup")}
        </Button>
      </form>
    </AuthLayout>
  );
}
