import { Compass, ShieldAlert, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Button, EmptyState, Spinner } from "@/core/ui/components";

export function FullScreenLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Spinner label={t("common.loading")} className="size-6" />
    </div>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={<Compass />}
        title={t("common.notFoundTitle")}
        description={t("common.notFoundBody")}
        action={
          <Button asChild>
            <Link to="/app">{t("common.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={<ShieldAlert />}
        title={t("common.forbiddenTitle")}
        description={t("common.forbiddenBody")}
        action={
          <Button asChild variant="secondary">
            <Link to="/app">{t("common.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}

/** errorElement của router: lỗi render không làm trắng cả app. */
export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={<TriangleAlert />}
        title={t("common.errorTitle")}
        description={t("common.errorBody")}
        action={<Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>}
      />
    </div>
  );
}
