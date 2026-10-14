import type { AuthResponse, Bootstrap, UserProfile } from "@/core/api/types";

// Fixture theo đúng kiểu contract (types.ts ↔ OpenAPI). Giá trị mặc định = mặc định của backend (config.js, settings.service.js).

export const userProfile = (over: Partial<UserProfile> = {}): UserProfile => ({
  _id: "65f000000000000000000001",
  name: "Nguyễn Văn An",
  profileImage: "",
  kind: "user",
  email: "an@example.com",
  roles: ["member"],
  status: "active",
  lastSeenAt: null,
  createdAt: "2026-10-01T03:00:00.000Z",
  ...over,
});

export const bootstrap = (over: Partial<Bootstrap> = {}): Bootstrap => ({
  me: userProfile(),
  permissions: { admin: false, agent: false },
  branding: { appName: "VNChat", logoUrl: "", primaryColor: "" },
  features: { realtime: true, uploads: false, support: true },
  limits: {
    maxMessageChars: 8000,
    maxGroupMembers: 500,
    maxFileBytes: 25 * 1024 * 1024,
    allowedMime: ["image/jpeg", "image/png", "application/pdf"],
    pollMaxOptions: 10,
    forwardMaxTargets: 10,
  },
  commandRules: [{ name: "task", description: "Giao việc cho người được tag", enabled: true }],
  unreadTotal: 0,
  nicknames: {},
  blockedUserIds: [],
  serverTime: "2026-10-14T03:00:00.000Z",
  ...over,
});

export const authResponse = (over: Partial<AuthResponse> = {}): AuthResponse => ({
  _id: "65f000000000000000000001",
  name: "Nguyễn Văn An",
  email: "an@example.com",
  kind: "user",
  roles: ["member"],
  profileImage: "",
  token: "header.payload.signature",
  ...over,
});

export const apiError = (code: string, message = "error", fields?: { field: string; message: string }[]) => ({
  message,
  code,
  ...(fields ? { fields } : {}),
});
