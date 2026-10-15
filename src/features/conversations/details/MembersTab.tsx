import { useQueryClient } from "@tanstack/react-query";
import { Crown, MoreHorizontal, ShieldCheck, UserMinus, UserPlus, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { qk } from "@/core/api/query";
import type { Conversation, MemberRole, MemberWithPresence, UserProfile } from "@/core/api/types";
import { useLimits, useSession } from "@/core/auth/session";
import { errorMessage, tDynamic } from "@/core/i18n";
import { ActionDropdown, type ActionItem } from "@/core/ui/components/action-menu";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  EmptyState,
  Skeleton,
} from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { usePresence } from "@/features/people/presence";
import { UserPicker } from "@/features/people/UserPicker";
import { applyGroup, groupApi, useMembers } from "@/features/groups/api";
import { useProfileSheet } from "@/features/people/profile-store";

/**
 * Thành viên nhóm. Quyền (server kiểm lại): thêm/xoá = owner/admin (xoá owner chỉ owner); đổi vai trò = chỉ owner.
 * Chuyển owner: server tự hạ owner cũ.
 */
export function MembersTab({ conversation: c }: { conversation: Conversation }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const members = useMembers(c._id);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "remove" | "owner"; member: MemberWithPresence } | null>(null);
  const manager = c.myRole === "owner" || c.myRole === "admin";
  const isGroup = c.kind === "group";

  const setRole = async (m: MemberWithPresence, role: "owner" | "admin" | "member") => {
    try {
      await groupApi.setRole(c._id, m.user._id, role);
      void qc.invalidateQueries({ queryKey: qk.members(c._id) });
    } catch (error) {
      toast.error(error);
    }
  };

  const actionsFor = (m: MemberWithPresence): ActionItem[] => {
    const items: ActionItem[] = [];
    const self = m.user._id === meId;
    if (!isGroup || self || m.role === "bot" || m.role === "agent") return items;
    if (c.myRole === "owner") {
      if (m.role !== "admin")
        items.push({
          key: "admin",
          label: t("details.makeAdmin"),
          icon: <ShieldCheck />,
          onSelect: () => void setRole(m, "admin"),
        });
      if (m.role !== "member")
        items.push({
          key: "member",
          label: t("details.makeMember"),
          icon: <UserRound />,
          onSelect: () => void setRole(m, "member"),
        });
      items.push({
        key: "owner",
        label: t("details.makeOwner"),
        icon: <Crown />,
        onSelect: () => setConfirm({ kind: "owner", member: m }),
      });
    }
    if (manager && (m.role !== "owner" || c.myRole === "owner")) {
      if (items.length) items.push({ type: "separator", key: "sep" });
      items.push({
        key: "remove",
        label: t("details.remove"),
        icon: <UserMinus />,
        destructive: true,
        onSelect: () => setConfirm({ kind: "remove", member: m }),
      });
    }
    return items;
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      {isGroup && manager && (
        <Button variant="secondary" className="justify-start" onClick={() => setAdding(true)}>
          <UserPlus aria-hidden="true" />
          {t("details.addMembers")}
        </Button>
      )}
      {members.isPending ? (
        Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-1 py-1.5" aria-hidden="true">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))
      ) : members.isError ? (
        <EmptyState title={errorMessage(members.error)} />
      ) : (
        <ul className="flex flex-col">
          {members.data.map((m) => (
            <MemberRow key={m.user._id} member={m} isMe={m.user._id === meId} actions={actionsFor(m)} />
          ))}
        </ul>
      )}
      {adding && (
        <AddMembersDialog
          conversation={c}
          existing={members.data?.map((m) => m.user._id) ?? []}
          onClose={() => setAdding(false)}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === "owner"
            ? t("details.makeOwnerConfirm", { name: confirm.member.user.name })
            : t("details.removeConfirm", { name: confirm?.member.user.name ?? "" })
        }
        description={confirm?.kind === "owner" ? t("details.makeOwnerBody") : t("details.removeBody")}
        confirmLabel={confirm?.kind === "owner" ? t("details.makeOwner") : t("details.remove")}
        destructive={confirm?.kind === "remove"}
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.kind === "owner") return setRole(confirm.member, "owner");
          try {
            await groupApi.remove(c._id, confirm.member.user._id);
            void qc.invalidateQueries({ queryKey: qk.members(c._id) });
          } catch (error) {
            toast.error(error);
          }
        }}
      />
    </div>
  );
}

function MemberRow({ member: m, isMe, actions }: { member: MemberWithPresence; isMe: boolean; actions: ActionItem[] }) {
  const { t } = useTranslation();
  const presence = usePresence(m.user._id);
  const nickname = useSession((s) => s.bootstrap?.nicknames[m.user._id]);
  const openProfile = useProfileSheet((s) => s.open);
  const online = presence?.online ?? m.online;
  const name = nickname || m.user.name;
  const roleTone = m.role === "owner" ? "primary" : m.role === "admin" ? "success" : "neutral";
  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
        onClick={() => !isMe && m.user.kind === "user" && openProfile(m.user._id)}
        disabled={isMe || m.user.kind !== "user"}
      >
        <Avatar
          src={m.user.profileImage}
          name={name}
          online={online}
          onlineLabel={online ? t("chat.online") : t("chat.offline")}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {name} {isMe && <span className="font-normal text-muted-foreground">{t("details.you")}</span>}
          </span>
          {nickname && <span className="block truncate text-xs text-muted-foreground">{m.user.name}</span>}
        </span>
      </button>
      {m.role !== "member" && <Badge tone={roleTone}>{tDynamic(`details.role.${m.role as MemberRole}`)}</Badge>}
      {actions.length > 0 && (
        <ActionDropdown
          items={actions}
          trigger={
            <button
              type="button"
              aria-label={t("details.memberActions", { name })}
              className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface hover:text-foreground coarse:size-11"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          }
        />
      )}
    </li>
  );
}

function AddMembersDialog({
  conversation: c,
  existing,
  onClose,
}: {
  conversation: Conversation;
  existing: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const limits = useLimits();
  const [picked, setPicked] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const room = (limits?.maxGroupMembers ?? 500) - c.memberCount;
  const toggle = (u: UserProfile, checked: boolean) =>
    setPicked((p) => (checked ? (p.length >= room ? p : [...p, u]) : p.filter((x) => x._id !== u._id)));
  const submit = async () => {
    setBusy(true);
    try {
      applyGroup(
        qc,
        await groupApi.add(
          c._id,
          picked.map((u) => u._id),
        ),
      );
      toast.success(t("details.added"));
      onClose();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t("details.addMembers")}
        className="h-[min(560px,calc(var(--app-height,100dvh)-2rem))]"
        footer={
          <Button onClick={() => void submit()} loading={busy} disabled={!picked.length}>
            {t("details.add", { count: picked.length })}
          </Button>
        }
      >
        <UserPicker
          mode="multiple"
          selected={picked.map((u) => u._id)}
          onToggle={toggle}
          excludeIds={existing}
          autoFocus
        />
      </DialogContent>
    </Dialog>
  );
}
