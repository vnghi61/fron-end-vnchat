import { AlertDialog as A } from "radix-ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";

/** Xác nhận thao tác không hoàn tác được (xoá, thu hồi, đăng xuất mọi nơi). Nút huỷ nhận focus mặc định. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => unknown | Promise<unknown>;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <A.Root open={isOpen} onOpenChange={setOpen}>
      {children && <A.Trigger asChild>{children}</A.Trigger>}
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 animate-fade-in bg-overlay" />
        <A.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 animate-scale-in rounded-lg border border-border bg-surface-raised p-5 shadow-lg">
          <A.Title className="text-lg font-semibold">{title}</A.Title>
          <A.Description className={description ? "mt-2 text-sm text-muted-foreground" : "sr-only"}>
            {description ?? title}
          </A.Description>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="secondary">{t("common.cancel")}</Button>
            </A.Cancel>
            <Button variant={destructive ? "danger" : "primary"} loading={busy} onClick={() => void confirm()}>
              {confirmLabel}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
