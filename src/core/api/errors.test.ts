import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { errorMessage } from "@/core/i18n";
import { ApiError, NETWORK_ERROR, errorKeyCandidates, toApiError } from "./errors";

const axiosError = (status: number | null, data?: unknown, headers: Record<string, string> = {}) => {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = status === null ? undefined : { status, statusText: "", data, headers, config };
  return new AxiosError("Request failed", status === null ? AxiosError.ERR_NETWORK : undefined, config, null, response);
};

describe("toApiError", () => {
  it("đọc {message, code, fields} của backend", () => {
    const e = toApiError(
      axiosError(400, {
        message: "validation",
        code: "CHAT-400-000",
        fields: [{ field: "title", message: "required" }],
      }),
    );
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(400);
    expect(e.code).toBe("CHAT-400-000");
    expect(e.fields).toEqual([{ field: "title", message: "required" }]);
  });

  it("lỗi mạng không có response → NETWORK, có thể thử lại", () => {
    const e = toApiError(axiosError(null));
    expect(e.code).toBe(NETWORK_ERROR);
    expect(e.isNetwork).toBe(true);
  });

  it("đọc Retry-After (giây) của 429", () => {
    const e = toApiError(axiosError(429, { message: "slow down", code: "CHAT-429-000" }, { "retry-after": "12" }));
    expect(e.retryAfter).toBe(12);
  });

  it("body không phải JSON chuẩn → mã theo HTTP status", () => {
    expect(toApiError(axiosError(502, "<html>")).code).toBe("HTTP-502");
  });
});

describe("errorKeyCandidates / errorMessage", () => {
  it("ưu tiên mã cụ thể, rồi họ mã, rồi chung", () => {
    const e = new ApiError({ status: 401, code: "CHAT-401-002", message: "x" });
    expect(errorKeyCandidates(e)).toEqual(["errors.CHAT-401-002", "errors.CHAT-401", "errors.unknown"]);
  });

  it("hiện tiếng Việt theo code, không bao giờ hiện message tiếng Anh của backend", () => {
    const e = new ApiError({ status: 400, code: "CHAT-400-015", message: "invalid credentials" });
    expect(errorMessage(e)).toBe("Sai email hoặc mật khẩu");
    expect(errorMessage(e)).not.toContain("invalid");
  });

  it("họ mã 404 dùng thông điệp chung", () => {
    expect(errorMessage(new ApiError({ status: 404, code: "CHAT-404-003", message: "message not found" }))).toBe(
      "Không tìm thấy",
    );
  });

  it("mã lạ + 5xx → thông điệp lỗi máy chủ chung", () => {
    expect(errorMessage(new ApiError({ status: 503, code: "HTTP-503", message: "" }))).toBe(
      "Có lỗi xảy ra, vui lòng thử lại",
    );
  });

  it("429 kèm số giây chờ", () => {
    const e = new ApiError({ status: 429, code: "CHAT-429-000", message: "", retryAfter: 5 });
    expect(errorMessage(e)).toContain("5 giây");
  });
});
