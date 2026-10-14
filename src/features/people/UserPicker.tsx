import { Search } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Id, UserProfile } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { cn } from "@/core/lib/cn";
import { Avatar, Badge, Checkbox, EmptyState, Input, Skeleton } from "@/core/ui/components";
import { useDebouncedValue } from "@/core/ui/hooks";
import { useUserSearch } from "./api";
import { usePresence } from "./presence";

/** Ô tìm + danh sách người dùng. single: bấm một người; multiple: tick nhiều người. */
export function UserPicker({
  mode,
  selected = [],
  onPick,
  onToggle,
  excludeIds = [],
  autoFocus,
}: {
  mode: "single" | "multiple";
  selected?: Id[];
  onPick?: (user: UserProfile) => void;
  onToggle?: (user: UserProfile, checked: boolean) => void;
  excludeIds?: Id[];
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 250);
  const search = useUserSearch(debounced);
  const blocked = useSession((s) => s.bootstrap?.blockedUserIds ?? []);
  const listId = useId();
  const users = (search.data?.items ?? []).filter((u) => !excludeIds.includes(u._id));

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("newChat.search")}
          aria-label={t("newChat.search")}
          aria-describedby={`${listId}-hint`}
          aria-controls={listId}
          className="pl-9"
          autoFocus={autoFocus}
          autoComplete="off"
        />
        <p id={`${listId}-hint`} className="sr-only">
          {t("newChat.searchHint")}
        </p>
      </div>
      <ul
        id={listId}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin"
        aria-busy={search.isFetching}
      >
        {search.isPending &&
          Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-2 py-2" aria-hidden="true">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </li>
          ))}
        {search.isError && <EmptyState title={errorMessage(search.error)} />}
        {search.isSuccess && users.length === 0 && <EmptyState title={t("newChat.noResults")} />}
        {users.map((u) => (
          <UserRow
            key={u._id}
            user={u}
            mode={mode}
            checked={selected.includes(u._id)}
            blocked={blocked.includes(u._id)}
            onPick={onPick}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </div>
  );
}

function UserRow({
  user,
  mode,
  checked,
  blocked,
  onPick,
  onToggle,
}: {
  user: UserProfile;
  mode: "single" | "multiple";
  checked: boolean;
  blocked: boolean;
  onPick?: (user: UserProfile) => void;
  onToggle?: (user: UserProfile, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const presence = usePresence(user._id);
  const nickname = useSession((s) => s.bootstrap?.nicknames[user._id]);
  const online = presence?.online ?? user.online ?? false;
  const content = (
    <>
      <Avatar
        src={user.profileImage}
        name={nickname || user.name}
        online={online}
        onlineLabel={online ? t("chat.online") : t("chat.offline")}
      />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{nickname || user.name}</span>
        {(nickname || user.email) && (
          <span className="block truncate text-xs text-muted-foreground">{nickname ? user.name : user.email}</span>
        )}
      </span>
      {blocked && <Badge tone="danger">{t("newChat.blocked")}</Badge>}
    </>
  );
  const rowClass =
    "flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted disabled:opacity-60";
  return (
    <li>
      {mode === "single" ? (
        <button type="button" className={rowClass} onClick={() => onPick?.(user)} disabled={blocked}>
          {content}
        </button>
      ) : (
        <label className={cn(rowClass, "cursor-pointer")}>
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => onToggle?.(user, v === true)}
            disabled={blocked}
            aria-label={user.name}
          />
          {content}
        </label>
      )}
    </li>
  );
}
