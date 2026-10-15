import { useQueryClient } from "@tanstack/react-query";
import { Ban, MessageCircle, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { qk } from "@/core/api/query";
import type { Id } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { formatRelative } from "@/core/lib/time";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  SheetContent,
  Skeleton,
} from "@/core/ui/components";
import { useShellPath } from "@/core/ui/shell";
import { toast } from "@/core/ui/toast";
import { accountApi } from "@/features/account/api";
import { openDirect } from "@/features/conversations/api";
import { useUser } from "./api";
import { ensurePresence, usePresence } from "./presence";
import { useProfileSheet } from "./profile-store";

/** Hồ sơ người khác (màn 21): nhắn tin, biệt danh riêng (chỉ mình thấy), chặn / bỏ chặn. Mở từ mọi nơi qua useProfileSheet. */
export function ProfileSheet() {
  const { t } = useTranslation();
  const userId = useProfileSheet((s) => s.userId);
  const close = useProfileSheet((s) => s.close);
  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && close()}>
      <SheetContent title={t("people.profile")}>
        {userId && <ProfileBody key={userId} userId={userId} onDone={close} />}
      </SheetContent>
    </Dialog>
  );
}

function ProfileBody({ userId, onDone }: { userId: Id; onDone: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const to = useShellPath();
  const user = useUser(userId);
  const presence = usePresence(userId);
  const nickname = useSession((s) => s.bootstrap?.nicknames[userId] ?? "");
  const blocked = useSession((s) => !!s.bootstrap?.blockedUserIds.includes(userId));
  const [draft, setDraft] = useState(nickname);
  const [busy, setBusy] = useState<"message" | "nickname" | "clear" | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    ensurePresence([userId]);
  }, [userId]);
  useEffect(() => setDraft(nickname), [nickname]);

  if (user.isPending)
    return (
      <div className="flex flex-col items-center gap-3 p-6" aria-hidden="true">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-5 w-40" />
      </div>
    );
  if (user.isError) return <EmptyState title={errorMessage(user.error)} />;
  const u = user.data;
  const online = presence?.online ?? u.online ?? false;
  const lastSeen = presence?.lastSeenAt ?? u.lastSeenAt;

  const message = async () => {
    setBusy("message");
    try {
      const conv = await openDirect(qc, userId);
      onDone();
      navigate(to(`/c/${conv._id}`));
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(null);
    }
  };

  const saveNickname = async (value: string) => {
    const clear = !value.trim();
    setBusy(clear ? "clear" : "nickname");
    try {
      if (clear) await accountApi.clearNickname(userId);
      else await accountApi.setNickname(userId, value.trim());
      useSession.getState().setNickname(userId, clear ? "" : value.trim());
      toast.success(clear ? t("people.nicknameCleared") : t("people.nicknameSaved"));
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(null);
    }
  };

  const toggleBlock = async () => {
    try {
      if (blocked) await accountApi.unblock(userId);
      else await accountApi.block(userId);
      useSession.getState().setBlocked(userId, !blocked);
      void qc.invalidateQueries({ queryKey: qk.blocks });
      toast.success(blocked ? t("people.unblocked", { name: u.name }) : t("people.blocked", { name: u.name }));
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col items-center gap-2 text-center">
        <Avatar
          src={u.profileImage}
          name={nickname || u.name}
          size="xl"
          online={online}
          onlineLabel={online ? t("chat.online") : t("chat.offline")}
        />
        <div className="min-w-0 max-w-full">
          <p className="truncate text-lg font-semibold">{nickname || u.name}</p>
          {nickname && <p className="truncate text-sm text-muted-foreground">{u.name}</p>}
          <p className="text-sm text-muted-foreground">
            {online
              ? t("chat.online")
              : lastSeen
                ? t("chat.lastSeen", { time: formatRelative(lastSeen) })
                : t("chat.offline")}
          </p>
          {u.email && <p className="truncate text-sm text-muted-foreground">{u.email}</p>}
          <p className="text-xs text-muted-foreground">{t("people.joined", { time: formatRelative(u.createdAt) })}</p>
        </div>
        {!blocked && (
          <Button onClick={() => void message()} loading={busy === "message"}>
            <MessageCircle aria-hidden="true" />
            {t("people.message")}
          </Button>
        )}
      </section>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void saveNickname(draft);
        }}
      >
        <Field label={t("people.nickname")} hint={t("people.nicknameHint")}>
          <Input value={draft} maxLength={64} onChange={(e) => setDraft(e.target.value)} autoComplete="off" />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          {nickname && (
            <Button variant="ghost" size="sm" loading={busy === "clear"} onClick={() => void saveNickname("")}>
              {t("people.clearNickname")}
            </Button>
          )}
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={busy === "nickname"}
            disabled={draft.trim() === nickname || !draft.trim()}
          >
            {t("people.saveNickname")}
          </Button>
        </div>
      </form>

      <div className="border-t border-border pt-4">
        {blocked ? (
          <Button variant="secondary" block onClick={() => void toggleBlock()}>
            <ShieldOff aria-hidden="true" />
            {t("people.unblock")}
          </Button>
        ) : (
          <Button variant="danger-ghost" block className="justify-start" onClick={() => setConfirmBlock(true)}>
            <Ban aria-hidden="true" />
            {t("people.block")}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={t("people.blockConfirm", { name: u.name })}
        description={t("people.blockBody")}
        confirmLabel={t("people.block")}
        onConfirm={toggleBlock}
      />
    </div>
  );
}
