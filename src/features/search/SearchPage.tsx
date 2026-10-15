import { useQueryClient } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type { Message } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage, tDynamic } from "@/core/i18n";
import { cn } from "@/core/lib/cn";
import { Avatar, Button, EmptyState, Field, Input, Segmented, Select, Skeleton } from "@/core/ui/components";
import { useDebouncedValue } from "@/core/ui/hooks";
import { findConversation } from "@/features/conversations/cache";
import { MessageResults } from "@/features/conversations/details/MessageResults";
import { conversationTitle } from "@/features/conversations/display";
import { useJumpTo } from "@/features/conversations/useJumpTo";
import { useUserSearch } from "@/features/people/api";
import { usePresence } from "@/features/people/presence";
import { useProfileSheet } from "@/features/people/profile-store";
import { PageHeader } from "@/features/shared/PageHeader";
import { useMessageSearch } from "./api";

const TYPES = ["all", "text", "file", "sticker", "poll", "command"] as const;
type Scope = "messages" | "people";

/**
 * Tìm kiếm toàn cục (màn 14): tin nhắn trong mọi hội thoại của tôi + người dùng. q/scope giữ trên URL để back/chia sẻ được.
 * Backend khớp TỪ nguyên vẹn, bỏ dấu (§4.9) – nói rõ trong gợi ý.
 * State là nguồn sự thật, URL chỉ được ĐỒNG BỘ MỘT CHIỀU: setSearchParams đọc params của lần render trước, hai thay đổi
 * liền nhau (chọn "Người" rồi gõ ngay) sẽ ghi đè nhau và mất `scope` – kịch bản E2E đã bắt được lỗi này.
 */
export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [scope, setScope] = useState<Scope>(params.get("scope") === "people" ? "people" : "messages");
  const [showFilters, setShowFilters] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debounced = useDebouncedValue(q.trim(), 300);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debounced) next.set("q", debounced);
    if (scope === "people") next.set("scope", "people");
    if (next.toString() !== window.location.search.replace(/^\?/, "")) setParams(next, { replace: true });
  }, [debounced, scope, setParams]);

  const filtersActive = type !== "all" || !!from || !!to;

  return (
    <div className="flex h-full flex-col bg-background">
      <PageHeader title={t("search.title")} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-3">
        <form role="search" className="relative" onSubmit={(e) => e.preventDefault()}>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.title")}
            className="pl-9"
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
          />
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented<Scope>
            label={t("search.title")}
            value={scope}
            onValueChange={setScope}
            options={[
              { value: "messages", label: t("search.messages") },
              { value: "people", label: t("search.people") },
            ]}
          />
          {scope === "messages" && (
            <Button variant="ghost" size="sm" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal aria-hidden="true" />
              {t("search.filters")}
              {filtersActive && <span className="size-2 rounded-full bg-primary" aria-hidden="true" />}
            </Button>
          )}
        </div>
        {scope === "messages" && showFilters && (
          <div className="grid gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-3">
            <Field label={t("search.type")}>
              <Select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}>
                {TYPES.map((v) => (
                  <option key={v} value={v}>
                    {tDynamic(`search.types.${v}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("search.from")}>
              <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t("search.to")}>
              <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </Field>
            {filtersActive && (
              <Button
                variant="link"
                className="justify-self-start sm:col-span-3"
                onClick={() => {
                  setType("all");
                  setFrom("");
                  setTo("");
                }}
              >
                {t("search.clear")}
              </Button>
            )}
          </div>
        )}
        {scope === "messages" && <p className="text-xs text-muted-foreground">{t("search.hint")}</p>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-2xl">
          {scope === "messages" ? (
            <MessageScope q={debounced} type={type} from={from} to={to} />
          ) : (
            <PeopleScope q={debounced} />
          )}
        </div>
      </div>
    </div>
  );
}

function MessageScope({ q, type, from, to }: { q: string; type: string; from: string; to: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const jumpTo = useJumpTo();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const nicknames = useSession((s) => s.bootstrap?.nicknames ?? {});
  const enabled = q.length > 0 || type !== "all" || !!from || !!to;
  const query = useMessageSearch(
    {
      q: q || undefined,
      type: type === "all" ? undefined : type,
      // ngày theo giờ máy → ISO có offset; "đến ngày" lấy hết ngày đó
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    },
    enabled,
  );
  if (!enabled) return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("search.typeMore")}</p>;
  const where = (m: Message) => {
    const conv = findConversation(qc, m.conversationId);
    return conv ? t("search.in", { name: conversationTitle(conv, meId, nicknames) }) : null;
  };
  return (
    <MessageResults query={query} empty={t("search.noResults")} onPick={(m) => jumpTo(m)} showConversation={where} />
  );
}

function PeopleScope({ q }: { q: string }) {
  const { t } = useTranslation();
  const search = useUserSearch(q, q.length > 0);
  const meId = useSession((s) => s.bootstrap?.me._id);
  if (!q) return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("search.typeMore")}</p>;
  if (search.isPending)
    return (
      <div className="flex flex-col gap-3 p-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    );
  if (search.isError) return <EmptyState title={errorMessage(search.error)} />;
  const users = search.data.items.filter((u) => u._id !== meId);
  if (!users.length) return <EmptyState title={t("search.noResults")} />;
  return (
    <ul className="flex flex-col p-2">
      {users.map((u) => (
        <PersonRow key={u._id} id={u._id} name={u.name} avatar={u.profileImage} email={u.email} />
      ))}
    </ul>
  );
}

export function PersonRow({
  id,
  name,
  avatar,
  email,
  className,
}: {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const presence = usePresence(id);
  const nickname = useSession((s) => s.bootstrap?.nicknames[id]);
  const open = useProfileSheet((s) => s.open);
  const online = presence?.online;
  return (
    <li>
      <button
        type="button"
        onClick={() => open(id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted coarse:py-3",
          className,
        )}
      >
        <Avatar
          src={avatar}
          name={nickname || name}
          online={online}
          onlineLabel={online ? t("chat.online") : t("chat.offline")}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{nickname || name}</span>
          <span className="block truncate text-xs text-muted-foreground">{nickname ? name : email}</span>
        </span>
      </button>
    </li>
  );
}
