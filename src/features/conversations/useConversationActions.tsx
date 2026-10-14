import { Archive, ArchiveRestore, BellOff, BellRing, Pin, PinOff } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "@/core/api/types";
import type { ActionItem } from "@/core/ui/components/action-menu";
import { usePrefsMutation, type PrefsAction } from "./api";

/** Hành động riêng của tôi trên một hội thoại: ghim, tắt thông báo, lưu trữ (dùng ở inbox và header chat). */
export function useConversationActions(c: Conversation | undefined): ActionItem[] {
  const { t } = useTranslation();
  const { mutate } = usePrefsMutation();
  return useMemo(() => {
    if (!c) return [];
    const run = (action: PrefsAction) => () => mutate({ id: c._id, action });
    const mute: ActionItem[] = c.muted
      ? [{ key: "unmute", label: t("inbox.unmute"), icon: <BellRing />, onSelect: run({ kind: "mute", minutes: 0 }) }]
      : [
          { type: "separator", key: "s1" },
          { type: "label", key: "mute-label", label: t("inbox.mute") },
          ...(
            [
              [60, t("inbox.mute60")],
              [480, t("inbox.mute480")],
              [1440, t("inbox.mute1440")],
              [-1, t("inbox.muteForever")],
            ] as const
          ).map(([minutes, label]): ActionItem => ({
            key: `mute-${minutes}`,
            label,
            icon: <BellOff />,
            onSelect: run({ kind: "mute", minutes }),
          })),
          { type: "separator", key: "s2" },
        ];
    return [
      {
        key: "pin",
        label: c.pinned ? t("inbox.unpin") : t("inbox.pin"),
        icon: c.pinned ? <PinOff /> : <Pin />,
        onSelect: run({ kind: "pin", value: !c.pinned }),
      },
      ...mute,
      {
        key: "archive",
        label: c.archived ? t("inbox.unarchive") : t("inbox.archive"),
        icon: c.archived ? <ArchiveRestore /> : <Archive />,
        onSelect: run({ kind: "archive", value: !c.archived }),
      },
    ];
  }, [c, mutate, t]);
}
