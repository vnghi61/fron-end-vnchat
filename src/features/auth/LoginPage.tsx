import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useSession } from "@/core/auth/session";
import { applyServerErrors } from "@/core/lib/forms";
import { authBase } from "@/core/lib/navigation";
import { Button, Field, Input } from "@/core/ui/components";
import { AuthLayout, FormAlert } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";

const schema = z.object({
  email: z.string().trim().email("auth.emailInvalid"),
  password: z.string().min(1, "auth.passwordRequired"),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const notice = useSession((s) => s.notice);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  useEffect(() => setFocus("email"), [setFocus]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await useSession.getState().login(values);
      // GuestOnly tự chuyển về ?next khi status = authenticated
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["email", "password"]));
      setFocus("password");
    }
  });

  const next = params.get("next");
  const base = authBase(useLocation().pathname);
  return (
    <AuthLayout
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link
            to={next ? `${base}/signup?next=${encodeURIComponent(next)}` : `${base}/signup`}
            className="font-medium text-primary-strong hover:underline"
          >
            {t("auth.toSignup")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {notice && notice !== "auth.loggedOut" && !formError && <FormAlert message={t(notice)} />}
        <FormAlert message={formError} />
        <Field label={t("auth.email")} error={errors.email?.message && t(errors.email.message as "auth.emailInvalid")}>
          <Input type="email" autoComplete="email" inputMode="email" {...register("email")} />
        </Field>
        <Field
          label={t("auth.password")}
          error={errors.password?.message && t(errors.password.message as "auth.passwordRequired")}
        >
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          {isSubmitting ? t("auth.submitting") : t("auth.submitLogin")}
        </Button>
      </form>
    </AuthLayout>
  );
}
