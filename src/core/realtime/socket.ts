import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { config } from "@/core/config";
import type { Ack, ClientEvents, ServerEventName, ServerEvents, ServerPayload } from "./events";

// Một kết nối Socket.IO cho tài liệu này. Xác thực bằng JWT (auth.token ở bearer, cookie ở cookie mode) –
// không còn query.userId. Chỉ coi là "online" sau event `ready` (server đã cho vào đủ room).

export type ConnectionState = "idle" | "connecting" | "ready" | "reconnecting" | "offline" | "unauthorized";

interface ConnectionStore {
  state: ConnectionState;
  /** Số lần đã `ready` – >1 nghĩa là kết nối lại (cần /api/sync). */
  readyCount: number;
  lastReadyAt: number | null;
}

export const useConnection = create<ConnectionStore>(() => ({ state: "idle", readyCount: 0, lastReadyAt: null }));

type AppSocket = Socket<ServerEvents, ClientEvents>;

let socket: AppSocket | null = null;
type Hooks = {
  onReady?: (info: { reconnect: boolean }) => void;
  /** Handshake bị từ chối vì phiên (CHAT-401-*) hoặc server ngắt chủ động. */
  onAuthProblem?: (code: string) => void;
};
let hooks: Hooks = {};

export function connectSocket(options: { token: string | null } & Hooks) {
  disconnectSocket();
  hooks = { onReady: options.onReady, onAuthProblem: options.onAuthProblem };
  useConnection.setState({ state: "connecting", readyCount: 0, lastReadyAt: null });

  const s: AppSocket = io(config.apiUrl || undefined, {
    withCredentials: true,
    auth: options.token ? { token: options.token } : undefined,
    transports: ["websocket", "polling"],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });
  socket = s;

  s.on("ready", () => {
    const { readyCount } = useConnection.getState();
    useConnection.setState({ state: "ready", readyCount: readyCount + 1, lastReadyAt: Date.now() });
    hooks.onReady?.({ reconnect: readyCount > 0 });
  });

  s.on("disconnect", (reason) => {
    if (socket !== s) return;
    // "io server disconnect": server chủ động ngắt (thu hồi session, khoá tài khoản) – Socket.IO không tự nối lại.
    if (reason === "io server disconnect") {
      useConnection.setState({ state: "offline" });
      hooks.onAuthProblem?.("SERVER_DISCONNECT");
      return;
    }
    if (reason === "io client disconnect") return;
    useConnection.setState({ state: navigator.onLine === false ? "offline" : "reconnecting" });
  });

  s.on("connect_error", (err: Error & { data?: { code?: string } }) => {
    if (socket !== s) return;
    const code = err.data?.code ?? "";
    if (code.startsWith("CHAT-401") || code === "CHAT-403-002") {
      useConnection.setState({ state: "unauthorized" });
      s.disconnect();
      hooks.onAuthProblem?.(code);
      return;
    }
    useConnection.setState({ state: navigator.onLine === false ? "offline" : "reconnecting" });
  });

  return s;
}

export function disconnectSocket() {
  if (!socket) return;
  const s = socket;
  socket = null;
  s.removeAllListeners();
  s.disconnect();
  useConnection.setState({ state: "idle" });
}

/** Kết nối lại thủ công (sau "io server disconnect" mà phiên vẫn còn hợp lệ, hoặc khi app quay về foreground). */
export function reconnectSocket() {
  if (socket && !socket.connected) socket.connect();
}

export const getSocket = () => socket;

/** Đăng ký nghe một event trên socket hiện tại; trả hàm huỷ. Gọi sau connectSocket (event router làm việc này). */
export function onSocketEvent<E extends ServerEventName>(event: E, handler: (payload: ServerPayload<E>) => void) {
  const s = socket;
  if (!s) return () => {};
  // Socket.IO typing generics không suy được handler từ union – ép kiểu tại một chỗ duy nhất.
  const h = handler as unknown as ServerEvents[E];
  (s.on as (e: E, cb: ServerEvents[E]) => void)(event, h);
  return () => (s.off as (e: E, cb: ServerEvents[E]) => void)(event, h);
}

const ACK_TIMEOUT_MS = 8000;

export function emitWithAck<E extends keyof ClientEvents>(
  event: E,
  payload: Parameters<ClientEvents[E]>[0],
): Promise<Ack> {
  const s = socket;
  if (!s?.connected) return Promise.resolve({ ok: false, code: "OFFLINE" });
  return new Promise((resolve) => {
    // Gọi như method (giữ `this`) – timeout() trả về một emitter tạm có ack kiểu (err, res).
    const timed = s.timeout(ACK_TIMEOUT_MS) as unknown as {
      emit: (e: E, p: Parameters<ClientEvents[E]>[0], cb: (err: Error | null, res: Ack) => void) => void;
    };
    timed.emit(event, payload, (err, res) => resolve(err ? { ok: false, code: "TIMEOUT" } : res));
  });
}
