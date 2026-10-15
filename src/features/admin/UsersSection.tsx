import { useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, MoreHorizontal, Search, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserProfile } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { formatRelative } from "@/core/lib/time";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  EmptyState,
  IconButton,
  Input,
  Select,
  Skeleton,
} from "@/core/ui/components";
import { ActionDropdown, type ActionItem } from "@/core/ui/components/action-menu";
import { useDebouncedValue } from "@/core/ui/hooks";
import { toast } from "@/core/ui/toast";
import { AdminError, AdminPage } from "./AdminPage";
import { adminApi, applyAdminUser, useAdminUsers, type AdminRole, type UserFilters } from "./api";

const ROLES: AdminRole[] = ["admin", "agent", "member"];

/** Người dùng (màn 19): lọc tên/email, loại, trạng thái, vai trò; đổi vai trò; khoá / mở khoá. */
export function UsersSection() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Omit<UserFilters, "q">>({ kind: "", status: "", role: "" });
  const debounced = useDebouncedValue(q.trim(), 300);
  const query = useAdminUsers({ q: debounced, ...filters });
  const users = query.data?.pages.flatMap((p) => p.items) ?? [];
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [locking, setLocking] = useState<UserProfile | null>(null);
  const qc = useQueryClient();

  const setStatus = async (u: UserProfile, status: "active" | "inactive") => {
    try {
      applyAdminUser(qc, await adminApi.setStatus(u._id, status));
      toast.success(
        status === "inactive" ? t("admin.users.locked", { name: u.name }) : t("admin.users.unlocked", { name: u.name }),
      );
    } catch (error) {
      toast.error(error);
    }
  };

  const select = (key: keyof typeof filters, label: string, options: [string, string][]) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Select value={filters[key]} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}>
        <option value="">{t("admin.users.any")}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </Select>
    </label>
  );

  return (
    <AdminPage title={t("admin.nav.users")}>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("common.search")}</span>
          <span className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("admin.users.search")}
              className="pl-9"
            />
          </span>
        </label>
        {select("kind", t("admin.users.kind"), [
          ["user", t("admin.users.kinds.user")],
          ["visitor", t("admin.users.kinds.visitor")],
          ["bot", t("admin.users.kinds.bot")],
        ])}
        {select("status", t("admin.users.status"), [
          ["active", t("admin.users.statuses.active")],
          ["inactive", t("admin.users.statuses.inactive")],
        ])}
        {select(
          "role",
          t("admin.users.role"),
          ROLES.map((r) => [r, t(`admin.users.roles.${r}`)]),
        )}
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : query.isError ? (
        <AdminError error={query.error} onRetry={() => void query.refetch()} />
      ) : users.length === 0 ? (
        <EmptyState icon={<Users />} title={t("admin.users.empty")} />
      ) : (
        <ul
          className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface"
          aria-busy={query.isFetching}
        >
          {users.map((u) => (
            <UserRow
              key={u._id}
              user={u}
              onRoles={() => setEditing(u)}
              onLock={() => setLocking(u)}
              onUnlock={() => void setStatus(u, "active")}
            />
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {t("common.loadMore")}
          </Button>
        </div>
      )}

      {editing && <RolesDialog user={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!locking}
        onOpenChange={(o) => !o && setLocking(null)}
        title={t("admin.users.lockConfirm", { name: locking?.name ?? "" })}
        description={t("admin.users.lockBody")}
        confirmLabel={t("admin.users.lock")}
        onConfirm={() => locking && setStatus(locking, "inactive")}
      />
    </AdminPage>
  );
}

function UserRow({
  user: u,
  onRoles,
  onLock,
  onUnlock,
}: {
  user: UserProfile;
  onRoles: () => void;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const { t } = useTranslation();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const locked = u.status === "inactive";
  const items: ActionItem[] = [];
  if (u.kind === "user")
    items.push({ key: "roles", label: t("admin.users.editRoles"), icon: <ShieldCheck />, onSelect: onRoles });
  if (locked) items.push({ key: "unlock", label: t("admin.users.unlock"), icon: <LockOpen />, onSelect: onUnlock });
  else if (u._id !== meId)
    items.push({ key: "lock", label: t("admin.users.lock"), icon: <Lock />, destructive: true, onSelect: onLock });
  return (
    <li className="flex items-center gap-3 p-3">
      <Avatar src={u.profileImage} name={u.name} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
          <span className="truncate">{u.name}</span>
          {u._id === meId && <span className="font-normal text-muted-foreground">{t("admin.users.you")}</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {u.email ?? t(`admin.users.kinds.${u.kind}`)} ·{" "}
          {t("admin.users.joined", { time: formatRelative(u.createdAt) })}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {locked && <Badge tone="danger">{t("admin.users.statuses.inactive")}</Badge>}
          {u.kind !== "user" && <Badge>{t(`admin.users.kinds.${u.kind}`)}</Badge>}
          {(u.roles ?? []).map((r) => (
            <Badge key={r} tone={r === "admin" ? "primary" : "neutral"}>
              {ROLES.includes(r as AdminRole) ? t(`admin.users.roles.${r as AdminRole}`) : r}
            </Badge>
          ))}
        </div>
      </div>
      {items.length > 0 && (
        <ActionDropdown
          items={items}
          trigger={
            <IconButton label={t("admin.users.actions", { name: u.name })} icon={<MoreHorizontal />} size="sm" />
          }
        />
      )}
    </li>
  );
}

function RolesDialog({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [roles, setRoles] = useState<AdminRole[]>(
    (user.roles ?? []).filter((r): r is AdminRole => ROLES.includes(r as AdminRole)),
  );
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      applyAdminUser(qc, await adminApi.setRoles(user._id, roles));
      toast.success(t("admin.users.rolesSaved"));
      onClose();
    } catch (error) {
      toast.error(error); // CHAT-409: phải còn ít nhất một admin đang hoạt động
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t("admin.users.rolesTitle", { name: user.name })}
        description={t("admin.users.rolesHint")}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} loading={busy} disabled={roles.length === 0}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">{t("admin.users.role")}</legend>
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={roles.includes(r)}
                onCheckedChange={(v) => setRoles((cur) => (v === true ? [...cur, r] : cur.filter((x) => x !== r)))}
              />
              {t(`admin.users.roles.${r}`)}
            </label>
          ))}
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
