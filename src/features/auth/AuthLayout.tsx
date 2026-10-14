import { MessagesSquare } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** Khung chung cho đăng nhập/đăng ký: một cột gọn, cuộn được khi bàn phím ảo mở. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="h-full overflow-y-auto bg-background safe-top safe-bottom safe-x">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div
            className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <MessagesSquare className="size-6" />
          </div>
          <p className="text-sm font-semibold tracking-wide text-primary-strong">{t("common.appName")}</p>
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-1 text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">{children}</div>
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </div>
    </div>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-sm border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}
