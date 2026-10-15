import { describe, expect, it } from "vitest";
import { removeUpload, useUploads, validateFile } from "./uploads";

const limits = { allowedMime: ["image/png", "application/pdf"], maxFileBytes: 1024 };
const file = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });

describe("validateFile", () => {
  it("accepts an allowed type under the size limit", () => {
    expect(validateFile(file("a.png", "image/png", 10), limits)).toBeNull();
  });

  it("maps a disallowed type to CHAT-400-007 and an oversize file to CHAT-413-001", () => {
    expect(validateFile(file("a.exe", "application/x-msdownload", 10), limits)?.code).toBe("CHAT-400-007");
    expect(validateFile(file("b.pdf", "application/pdf", 2048), limits)?.code).toBe("CHAT-413-001");
  });

  it("does not restrict types when the server sends an empty allow-list", () => {
    expect(validateFile(file("a.bin", "application/octet-stream", 10), { ...limits, allowedMime: [] })).toBeNull();
  });
});

describe("upload queue store", () => {
  it("keeps queues per conversation and removes a single item", () => {
    const f = file("a.png", "image/png", 1);
    useUploads.getState().add("c1", [
      { id: "u1", file: f, status: "done", progress: 1 },
      { id: "u2", file: f, status: "failed", progress: 0 },
    ]);
    useUploads.getState().add("c2", [{ id: "u3", file: f, status: "uploading", progress: 0.5 }]);
    removeUpload("c1", "u2");
    expect(useUploads.getState().byConversation.c1?.map((i) => i.id)).toEqual(["u1"]);
    expect(useUploads.getState().byConversation.c2?.map((i) => i.id)).toEqual(["u3"]);
  });
});
