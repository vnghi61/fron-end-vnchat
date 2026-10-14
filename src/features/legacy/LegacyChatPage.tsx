import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, path } from "@/core/api/http";
import type { Message, UserProfile } from "@/core/api/types";
import { useMe } from "@/core/auth/session";
import { cn } from "@/core/lib/cn";
import { getSocket } from "@/core/realtime/socket";
import { Avatar, EmptyState, IconButton, Input, Skeleton } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";

// TẠM THỜI (Phase 1): giữ chức năng chat 1-1 cũ trên API Legacy (/api/messages/*, event newMessage) trong lúc chuyển
// sang Conversations ở Phase 2. Đã sửa so với bản cũ: socket xác thực JWT, đọc `name`/`profileImage` (bản cũ đọc
// fullName/profilePic không tồn tại), gửi kèm clientMsgId. Gỡ ở Phase 7 sau khi E2E xác nhận Conversations tương đương.

type LegacyMessage = Message & { receiverId?: string };

export function LegacyChatPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const users = useQuery({
    queryKey: ["legacy", "users"],
    queryFn: () => api.get<UserProfile[]>("/api/messages/users"),
  });
  const messages = useQuery({
    queryKey: ["legacy", "messages", selected?._id],
    queryFn: () => api.get<LegacyMessage[]>(path`/api/messages/${selected?._id ?? ""}`),
    enabled: !!selected,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !selected) return;
    const onNew = (m: LegacyMessage) => {
      if (m.senderId !== selected._id) return;
      queryClient.setQueryData<LegacyMessage[]>(["legacy", "messages", selected._id], (old = []) =>
        old.some((x) => x._id === m._id) ? old : [...old, m],
      );
    };
    const s = socket as unknown as {
      on: (e: string, h: (m: LegacyMessage) => void) => void;
      off: (e: string, h: (m: LegacyMessage) => void) => void;
    };
    s.on("newMessage", onNew);
    return () => s.off("newMessage", onNew);
  }, [selected, queryClient]);

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages.data]);

  const send = async () => {
    if (!selected || !text.trim()) return;
    const body = { text: text.trim(), clientMsgId: crypto.randomUUID() };
    setText("");
    try {
      const msg = await api.post<LegacyMessage>(path`/api/messages/send/${selected._id}`, body);
      queryClient.setQueryData<LegacyMessage[]>(["legacy", "messages", selected._id], (old = []) => [...old, msg]);
    } catch (error) {
      setText(body.text);
      toast.error(error);
    }
  };

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface max-[480px]:w-20">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Danh bạ (API cũ)</div>
        <ul className="flex-1 overflow-y-auto scrollbar-thin">
          {users.isPending &&
            Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </li>
            ))}
          {users.data?.map((u) => (
            <li key={u._id}>
              <button
                onClick={() => setSelected(u)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted",
                  selected?._id === u._id && "bg-primary-soft",
                )}
              >
                <Avatar src={u.profileImage} name={u.name} />
                <span className="truncate text-sm font-medium">{u.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <EmptyState
            icon={<MessagesSquare />}
            title="VNChat"
            description="Chọn một người để bắt đầu trò chuyện"
            className="flex-1"
          />
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
              <Avatar src={selected.profileImage} name={selected.name} size="sm" />
              <span className="font-semibold">{selected.name}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4 scrollbar-thin" role="log" aria-label={selected.name}>
              {messages.data?.map((m) => {
                const mine = m.senderId === me?._id;
                return (
                  <div key={m._id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] whitespace-pre-wrap break-words rounded-lg px-3 py-2",
                        mine
                          ? "bg-bubble-mine text-bubble-mine-foreground"
                          : "border border-border bg-bubble-other text-bubble-other-foreground",
                      )}
                    >
                      {m.image && <img src={m.image} alt="" className="mb-1 max-w-52 rounded-md" />}
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form
              className="flex items-center gap-2 border-t border-border bg-surface p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nhập tin nhắn…"
                aria-label="Nhập tin nhắn"
              />
              <IconButton type="submit" label="Gửi" icon={<Send />} variant="primary" disabled={!text.trim()} />
            </form>
          </>
        )}
      </section>
    </div>
  );
}
