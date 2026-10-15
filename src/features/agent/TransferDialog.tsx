import { useTranslation } from "react-i18next";
import type { Id, SupportAgent } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import { Avatar, Dialog, DialogContent, EmptyState, Skeleton } from "@/core/ui/components";
import { useSupportAgents } from "@/features/support/api";

/** Chọn nhân viên (GET /api/support/agents kèm online) để chuyển yêu cầu, hoặc admin gán hộ. */
export function TransferDialog({
  title,
  excludeId,
  onPick,
  onClose,
}: {
  title: string;
  excludeId: Id | null;
  onPick: (agent: SupportAgent) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const agents = useSupportAgents(true);
  const meId = useSession((s) => s.bootstrap?.me._id);
  const list = (agents.data ?? [])
    .filter((a) => a._id !== excludeId)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "vi"));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={title} size="sm">
        {agents.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : agents.isError ? (
          <EmptyState title={errorMessage(agents.error)} />
        ) : list.length === 0 ? (
          <EmptyState title={t("agent.noAgents")} />
        ) : (
          <ul className="flex flex-col">
            {list.map((a) => (
              <li key={a._id}>
                <button
                  type="button"
                  onClick={() => onPick(a)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted coarse:py-3"
                >
                  <Avatar
                    src={a.profileImage}
                    name={a.name}
                    online={a.online}
                    onlineLabel={a.online ? t("chat.online") : t("chat.offline")}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {a.name}{" "}
                    {a._id === meId && <span className="font-normal text-muted-foreground">{t("agent.you")}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.online ? t("chat.online") : t("chat.offline")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
