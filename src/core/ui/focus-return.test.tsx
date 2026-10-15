import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TooltipProvider,
} from "@/core/ui/components";

// Dialog mở bằng state (không có Dialog.Trigger) phải trả focus về nút đã mở khi đóng – Radix chỉ tự làm với Trigger.

function StateDialog({ autoFocus = false }: { autoFocus?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mở hộp thoại
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Hộp thoại">
          {/* autoFocus giống ô tìm kiếm trong "Cuộc trò chuyện mới" */}
          <input aria-label="Ô trong hộp thoại" autoFocus={autoFocus} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function MenuDialog() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Thao tác</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setOpen(true)}>Chuyển tiếp</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm(true)}>Xoá</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Chuyển tiếp">
          <input aria-label="Tìm người nhận" />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Xoá?"
        confirmLabel="Xoá"
        onConfirm={() => undefined}
      />
    </>
  );
}

const renderUi = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("focus return for dialogs opened from state", () => {
  it("returns focus to the opener button after Escape", async () => {
    const user = userEvent.setup();
    renderUi(<StateDialog />);
    const opener = screen.getByRole("button", { name: "Mở hộp thoại" });
    await user.click(opener);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(opener).not.toHaveFocus();
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await vi.waitFor(() => expect(opener).toHaveFocus());
  });

  it("still returns focus to the opener when a field inside the dialog has autoFocus", async () => {
    const user = userEvent.setup();
    renderUi(<StateDialog autoFocus />);
    const opener = screen.getByRole("button", { name: "Mở hộp thoại" });
    await user.click(opener);
    await vi.waitFor(() => expect(screen.getByLabelText("Ô trong hộp thoại")).toHaveFocus());
    for (let i = 0; i < 15; i += 1) await user.tab(); // nhiều bước focus trong dialog không làm mất phần tử mở
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await vi.waitFor(() => expect(opener).toHaveFocus());
  });

  it("returns focus to the menu trigger when the dialog was opened from a menu item", async () => {
    const user = userEvent.setup();
    renderUi(<MenuDialog />);
    const trigger = screen.getByRole("button", { name: "Thao tác" });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Chuyển tiếp" }));
    expect(await screen.findByRole("dialog", { name: "Chuyển tiếp" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });

  it("does the same for the confirmation dialog", async () => {
    const user = userEvent.setup();
    renderUi(<MenuDialog />);
    const trigger = screen.getByRole("button", { name: "Thao tác" });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Xoá" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });
});
