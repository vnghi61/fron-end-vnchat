import { AxiosError, isAxiosError } from "axios";

// Lỗi backend luôn có dạng { message, code, fields? } (openapi.yaml#/components/schemas/Error).
// UI hiển thị theo `code` (i18n), `message` tiếng Anh chỉ để log khi dev.

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldError[];
  /** Giây chờ theo header Retry-After (429). */
  readonly retryAfter: number | null;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    fields?: FieldError[];
    retryAfter?: number | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields ?? [];
    this.retryAfter = init.retryAfter ?? null;
  }

  /** Lỗi mạng / timeout: có thể thử lại cùng request (vd. gửi tin cùng clientMsgId). */
  get isNetwork() {
    return this.code === NETWORK_ERROR || this.code === TIMEOUT_ERROR;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }
}

export const NETWORK_ERROR = "NETWORK";
export const TIMEOUT_ERROR = "TIMEOUT";
export const UNKNOWN_ERROR = "UNKNOWN";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const parseFields = (v: unknown): FieldError[] =>
  Array.isArray(v)
    ? v.filter(isRecord).map((f) => ({ field: String(f.field ?? ""), message: String(f.message ?? "") }))
    : [];

const parseRetryAfter = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(String(value));
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000));
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) return fromAxios(error);
  return new ApiError({
    status: 0,
    code: UNKNOWN_ERROR,
    message: error instanceof Error ? error.message : String(error),
  });
}

function fromAxios(error: AxiosError): ApiError {
  const res = error.response;
  if (!res) {
    const timeout = error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT;
    return new ApiError({ status: 0, code: timeout ? TIMEOUT_ERROR : NETWORK_ERROR, message: error.message });
  }
  const body = isRecord(res.data) ? res.data : {};
  const code = typeof body.code === "string" && body.code ? body.code : `HTTP-${res.status}`;
  return new ApiError({
    status: res.status,
    code,
    message: typeof body.message === "string" ? body.message : error.message,
    fields: parseFields(body.fields),
    retryAfter: parseRetryAfter(res.headers?.["retry-after"]),
  });
}

/**
 * Khoá i18n cho một lỗi: mã cụ thể (`errors.CHAT-403-003`) → họ mã (`errors.CHAT-401`) → theo HTTP status → chung.
 * `known` là tập khoá có trong bản dịch (truyền vào để hàm thuần, dễ test).
 */
export function errorKeyCandidates(error: ApiError): string[] {
  const keys = [`errors.${error.code}`];
  const family = /^(CHAT-\d{3})-/.exec(error.code)?.[1];
  if (family) keys.push(`errors.${family}`);
  if (error.status >= 500) keys.push("errors.CHAT-500-000");
  if (error.status === 429) keys.push("errors.CHAT-429-000");
  keys.push("errors.unknown");
  return keys;
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
