import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { qk } from "@/core/api/query";
import type { HistoryVisibility, UserProfile } from "@/core/api/types";
import { useLimits } from "@/core/auth/session";
import { errorMessage } from "@/core/i18n";
import {
  Button,
  Dialog,
  DialogContent,
  Field,
  Input,
  Segmented,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/core/ui/components";
import { useShellPath } from "@/core/ui/shell";
import { toast } from "@/core/ui/toast";
import { FormAlert } from "@/features/auth/AuthLayout";
import { UserPicker } from "@/features/people/UserPicker";
import { conversationApi, openDirect } from "./api";
import { applyConversation } from "./cache";

/** Mở chat 1-1 (POST /api/conversations/direct) hoặc tạo nhóm (POST /api/conversations/group). */
export function NewChatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"direct" | "group">("direct");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent
          title={t("newChat.title")}
          size="md"
          className="h-[min(640px,calc(var(--app-height,100dvh)-2rem))]"
        >
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "direct" | "group")}
            className="flex h-full min-h-0 flex-col"
          >
            <TabsList className="mb-3">
              <TabsTrigger value="direct">{t("newChat.direct")}</TabsTrigger>
              <TabsTrigger value="group">{t("newChat.group")}</TabsTrigger>
            </TabsList>
            <TabsContent value="direct" className="flex min-h-0 flex-1 flex-col">
              <DirectTab onDone={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="group" className="flex min-h-0 flex-1 flex-col">
              <GroupTab onDone={() => onOpenChange(false)} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      )}
    </Dialog>
  );
}

function DirectTab({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const to = useShellPath();
  const [busy, setBusy] = useState(false);
  const pick = async (user: UserProfile) => {
    if (busy) return;
    setBusy(true);
    try {
      const conv = await openDirect(qc, user._id);
      onDone();
      navigate(to(`/c/${conv._id}`));
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };
  return <UserPicker mode="single" onPick={(u) => void pick(u)} autoFocus />;
}

function GroupTab({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const to = useShellPath();
  const limits = useLimits();
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<HistoryVisibility>("all");
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const max = (limits?.maxGroupMembers ?? 500) - 1; // trừ người tạo

  const toggle = (user: UserProfile, checked: boolean) =>
    setMembers((m) => (checked ? (m.length >= max ? m : [...m, user]) : m.filter((x) => x._id !== user._id)));

  const create = async () => {
    setError(null);
    if (!title.trim()) return setTitleError(t("newChat.groupNameRequired"));
    if (members.length === 0) return setError(t("newChat.groupMembersHint"));
    setBusy(true);
    try {
      const conv = await conversationApi.createGroup({
        title: title.trim(),
        memberIds: members.map((m) => m._id),
        historyVisibility: history,
      });
      qc.setQueryData(qk.conversation(conv._id), conv);
      applyConversation(qc, conv, { toTop: true });
      onDone();
      navigate(to(`/c/${conv._id}`));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <FormAlert message={error} />
      <Field label={t("newChat.groupName")} error={titleError}>
        <Input
          value={title}
          maxLength={100}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(undefined);
          }}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("newChat.historyVisibility")}</span>
        <Segmented<HistoryVisibility>
          label={t("newChat.historyVisibility")}
          value={history}
          onValueChange={setHistory}
          options={[
            { value: "all", label: t("newChat.historyAll") },
            { value: "since_join", label: t("newChat.historySinceJoin") },
          ]}
          className="self-start"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t("newChat.groupMembers")}</span>
          <span className="text-xs text-muted-foreground">{t("newChat.selected", { count: members.length })}</span>
        </div>
        {members.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <li key={m._id}>
                <button
                  type="button"
                  onClick={() => toggle(m, false)}
                  aria-label={t("newChat.remove", { name: m.name })}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft pl-2.5 pr-1.5 text-xs font-medium text-primary-strong hover:opacity-80"
                >
                  {m.name}
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <UserPicker mode="multiple" selected={members.map((m) => m._id)} onToggle={toggle} />
      </div>
      <div className="flex justify-end border-t border-border pt-3">
        <Button onClick={() => void create()} loading={busy}>
          {t("newChat.create")}
        </Button>
      </div>
    </div>
  );
}
