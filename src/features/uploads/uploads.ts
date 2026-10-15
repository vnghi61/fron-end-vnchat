import { create } from "zustand";
import { ApiError, toApiError } from "@/core/api/errors";
import { api } from "@/core/api/http";
import type { Id, Limits, UploadSignature } from "@/core/api/types";
import { uuid } from "@/core/lib/id";

// Upload thẳng lên Cloudinary bằng chữ ký backend (§5.5 cách 2): POST /api/files/signature → multipart tới uploadUrl
// → đính kèm {url, publicId, name, size, mime} vào tin. KHÔNG phải upload chia khúc/resume: lỗi thì tải lại cả tệp.
// Tin chỉ được gửi khi mọi tệp đã có URL (spec §5.11).

export interface UploadedFile {
  url: string;
  publicId: string;
  name: string;
  size: number;
  mime: string;
}

export interface UploadItem {
  id: string;
  file: File;
  status: "uploading" | "done" | "failed";
  progress: number;
  error?: ApiError;
  result?: UploadedFile;
}

export const MAX_FILES_PER_MESSAGE = 10; // server: attachments.max(10)

export function validateFile(file: File, limits: Pick<Limits, "allowedMime" | "maxFileBytes">): ApiError | null {
  if (limits.allowedMime.length && !limits.allowedMime.includes(file.type)) {
    return new ApiError({ status: 400, code: "CHAT-400-007", message: `unsupported ${file.type}` });
  }
  if (file.size > limits.maxFileBytes)
    return new ApiError({ status: 413, code: "CHAT-413-001", message: "file too large" });
  return null;
}

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  bytes: number;
}

/** Upload một tệp bằng XHR (cần tiến trình – fetch chưa có upload progress). */
export function uploadToCloudinary(
  file: File,
  sig: UploadSignature,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<CloudinaryResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", String(sig.timestamp));
    form.append("folder", sig.folder);
    form.append("signature", sig.signature);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sig.uploadUrl);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as Partial<CloudinaryResponse> & { error?: { message?: string } };
        if (xhr.status >= 200 && xhr.status < 300 && body.secure_url && body.public_id)
          resolve(body as CloudinaryResponse);
        else
          reject(
            new ApiError({
              status: xhr.status,
              code: xhr.status === 413 ? "CHAT-413-001" : "UNKNOWN",
              message: body.error?.message ?? "upload failed",
            }),
          );
      } catch {
        reject(new ApiError({ status: xhr.status, code: "UNKNOWN", message: "invalid upload response" }));
      }
    };
    xhr.onerror = () => reject(new ApiError({ status: 0, code: "NETWORK", message: "upload network error" }));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
}

// ---------- hàng đợi theo hội thoại ----------

interface UploadState {
  byConversation: Record<Id, UploadItem[]>;
  patch: (conversationId: Id, id: string, patch: Partial<UploadItem>) => void;
  add: (conversationId: Id, items: UploadItem[]) => void;
  remove: (conversationId: Id, id: string) => void;
  clear: (conversationId: Id) => void;
}

export const useUploads = create<UploadState>((set) => ({
  byConversation: {},
  patch: (cid, id, patch) =>
    set((s) => ({
      byConversation: {
        ...s.byConversation,
        [cid]: (s.byConversation[cid] ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
      },
    })),
  add: (cid, items) =>
    set((s) => ({ byConversation: { ...s.byConversation, [cid]: [...(s.byConversation[cid] ?? []), ...items] } })),
  remove: (cid, id) =>
    set((s) => ({
      byConversation: { ...s.byConversation, [cid]: (s.byConversation[cid] ?? []).filter((i) => i.id !== id) },
    })),
  clear: (cid) => set((s) => ({ byConversation: { ...s.byConversation, [cid]: [] } })),
}));

const controllers = new Map<string, AbortController>();
let signature: { value: UploadSignature; conversationId: Id; at: number } | null = null;

async function getSignature(conversationId: Id): Promise<UploadSignature> {
  // Chữ ký có timestamp; dùng lại trong 10 phút cho cùng hội thoại.
  if (signature && signature.conversationId === conversationId && Date.now() - signature.at < 10 * 60_000)
    return signature.value;
  const value = await api.post<UploadSignature>("/api/files/signature", { conversationId });
  signature = { value, conversationId, at: Date.now() };
  return value;
}

async function run(conversationId: Id, item: UploadItem) {
  const store = useUploads.getState();
  const controller = new AbortController();
  controllers.set(item.id, controller);
  store.patch(conversationId, item.id, { status: "uploading", progress: 0, error: undefined });
  try {
    const sig = await getSignature(conversationId);
    const res = await uploadToCloudinary(
      item.file,
      sig,
      (p) => useUploads.getState().patch(conversationId, item.id, { progress: p }),
      controller.signal,
    );
    useUploads.getState().patch(conversationId, item.id, {
      status: "done",
      progress: 1,
      result: {
        url: res.secure_url,
        publicId: res.public_id,
        name: item.file.name,
        size: res.bytes ?? item.file.size,
        mime: item.file.type,
      },
    });
  } catch (error) {
    if (controller.signal.aborted) return;
    useUploads.getState().patch(conversationId, item.id, { status: "failed", error: toApiError(error) });
  } finally {
    controllers.delete(item.id);
  }
}

/** Thêm tệp đã qua kiểm tra vào hàng đợi và bắt đầu tải (tối đa 3 tệp song song là đủ cho chat). */
export function enqueueUploads(conversationId: Id, files: File[]) {
  const items = files.map((file): UploadItem => ({ id: uuid(), file, status: "uploading", progress: 0 }));
  useUploads.getState().add(conversationId, items);
  void (async () => {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) await run(conversationId, queue.shift()!);
    });
    await Promise.all(workers);
  })();
}

export function retryUpload(conversationId: Id, id: string) {
  const item = useUploads.getState().byConversation[conversationId]?.find((i) => i.id === id);
  if (item) void run(conversationId, item);
}

export function removeUpload(conversationId: Id, id: string) {
  controllers.get(id)?.abort();
  useUploads.getState().remove(conversationId, id);
}
