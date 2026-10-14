import { setupServer } from "msw/node";

// MSW chỉ dùng trong test để giả lập response ĐÚNG contract backend (fixtures.ts) – không bao giờ chạy trong app.
export const server = setupServer();
