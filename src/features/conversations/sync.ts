import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/http";
import { qk } from "@/core/api/query";
import type { Conversation, ISODate, Message } from "@/core/api/types";
import { useSession } from "@/core/auth/session";
import { upsertMessage, withMyReactions } from "@/features/messages/cache";
import { refreshPresence } from "@/features/people/presence";
import { applyConversation } from "./cache";

// Bù dữ liệu sau khi mất kết nối / quay lại foreground (spec §5.7): GET /api/sync?since=<mốc>.
// Socket.IO không phát lại event bị lỡ. Mốc đầu = bootstrap.serverTime, sau mỗi lần = `until`.
//
// B1 (contract map): khi hasMore=true backend KHÔNG trả cursor tiếp → không thể phân trang an toàn. Áp phần đã nhận,
// rồi làm mới toàn bộ query tin + inbox và đặt since = until.

interface SyncResponse {
  conversations: Conversation[];
  messages: Message[];
  until: ISODate;
  hasMore: boolean;
}

let since: ISODate | null = null;
let running: Promise<void> | null = null;

export function resetSyncCursor(value: ISODate | null) {
  since = value;
}

export function syncNow(qc: QueryClient): Promise<void> {
  running ??= doSync(qc).finally(() => {
    running = null;
  });
  return running;
}

async function doSync(qc: QueryClient) {
  since ??= useSession.getState().bootstrap?.serverTime ?? null;
  if (!since) return;
  const meId = useSession.getState().bootstrap?.me._id;
  const res = await api.get<SyncResponse>("/api/sync", { params: { since, limit: 500 } });
  for (const conv of res.conversations) {
    qc.setQueryData<Conversation>(qk.conversation(conv._id), (old) => (old ? conv : old));
    applyConversation(qc, conv);
  }
  for (const msg of res.messages) upsertMessage(qc, withMyReactions(msg, meId));
  since = res.until;

  if (res.hasMore) {
    await qc.invalidateQueries({ queryKey: qk.messagesAll });
  }
  // B5: hội thoại tôi bị xoá khỏi lúc offline không có trong /api/sync → làm mới inbox (chạy nền)
  void qc.invalidateQueries({ queryKey: qk.conversationsAll });
  void useSession
    .getState()
    .refreshBootstrap()
    .catch(() => undefined);
  refreshPresence();
}
