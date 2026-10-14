import { useTranslation } from "react-i18next";
import type { Id } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { useTypingUsers } from "./typing";

/** "<tên> đang nhập…" – giữ chỗ cố định 20px để composer không nhảy khi dòng này xuất hiện/biến mất. */
export function TypingIndicator({ conversationId }: { conversationId: Id }) {
  const { t } = useTranslation();
  const meId = useSession((s) => s.bootstrap?.me._id);
  const nicknames = useSession((s) => s.bootstrap?.nicknames);
  const users = useTypingUsers(conversationId, meId);
  const name = (u: { _id: string; name: string }) => nicknames?.[u._id] || u.name;
  const text =
    users.length === 0
      ? ""
      : users.length === 1
        ? t("chat.typingOne", { name: name(users[0]!) })
        : users.length === 2
          ? t("chat.typingTwo", { a: name(users[0]!), b: name(users[1]!) })
          : t("chat.typingMany");
  return (
    <div className="h-5 shrink-0 truncate px-4 text-xs text-muted-foreground" aria-live="polite">
      {text && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex gap-0.5" aria-hidden="true">
            <span className="size-1 animate-pulse rounded-full bg-current" />
            <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
            <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
          </span>
          {text}
        </span>
      )}
    </div>
  );
}
