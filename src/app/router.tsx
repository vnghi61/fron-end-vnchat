import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from "react-router-dom";
import { GuestOnly, RequireAuth, RequirePermission } from "./guards";
import { FullScreenLoader, NotFoundPage, RouteErrorPage } from "./pages/status-pages";
import { AgentShell } from "./shells/AgentShell";
import { AppShell } from "./shells/AppShell";

// Route frontend (KHÔNG phải endpoint backend): /app (full), /compact (WebView/iframe hẹp), /login, /signup.
// /support (console hỗ trợ), /widget (khách); /admin, /embed được thêm ở các phase tương ứng. Trang tách chunk (lazy) để màn chat tải nhanh.

const page =
  <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) =>
  async () => ({ Component: (await load())[name] as ComponentType });

const memberRoutes = (base: string): RouteObject[] => [
  {
    lazy: page(() => import("@/features/conversations/ChatsLayout"), "ChatsLayout"),
    children: [
      { index: true, lazy: page(() => import("@/features/conversations/ChatsLayout"), "NoChatSelected") },
      { path: "c/:conversationId", lazy: page(() => import("@/features/conversations/ChatView"), "ChatView") },
    ],
  },
  { path: "search", lazy: page(() => import("@/features/search/SearchPage"), "SearchPage") },
  { path: "people", lazy: page(() => import("@/features/people/PeoplePage"), "PeoplePage") },
  { path: "reminders", lazy: page(() => import("@/features/reminders/RemindersPage"), "RemindersPage") },
  // API cũ (/api/messages/*) – giữ tới khi E2E xác nhận Conversations tương đương (Phase 7)
  { path: "legacy", lazy: page(() => import("@/features/legacy/LegacyChatPage"), "LegacyChatPage") },
  {
    path: "settings",
    lazy: page(() => import("@/features/account/SettingsLayout"), "SettingsLayout"),
    children: [
      { path: "profile", lazy: page(() => import("@/features/account/ProfileSettings"), "ProfileSettings") },
      { path: "appearance", lazy: page(() => import("@/features/account/AppearanceSettings"), "AppearanceSettings") },
      { path: "sessions", lazy: page(() => import("@/features/account/SessionsSettings"), "SessionsSettings") },
      { path: "blocks", lazy: page(() => import("@/features/account/BlocksSettings"), "BlocksSettings") },
    ],
  },
  { path: "*", element: <Navigate to={base} replace /> },
];

export const routes: RouteObject[] = [
  {
    element: <Outlet />,
    errorElement: <RouteErrorPage />,
    HydrateFallback: FullScreenLoader,
    children: [
      { path: "/", element: <Navigate to="/app" replace /> },
      // Widget khách: không cần đăng nhập thành viên, transport cách ly (main.tsx)
      { path: "/widget", lazy: page(() => import("@/features/widget/WidgetPage"), "WidgetPage") },
      {
        element: <GuestOnly />,
        children: [
          { path: "/login", lazy: page(() => import("@/features/auth/LoginPage"), "LoginPage") },
          { path: "/signup", lazy: page(() => import("@/features/auth/SignupPage"), "SignupPage") },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: "/app", element: <AppShell variant="full" base="/app" />, children: memberRoutes("/app") },
          {
            path: "/compact",
            element: <AppShell variant="compact" base="/compact" />,
            children: memberRoutes("/compact"),
          },
          {
            path: "/support",
            element: <RequirePermission permission="agent" />,
            children: [
              {
                element: <AgentShell />,
                children: [
                  { index: true, lazy: page(() => import("@/features/agent/AgentConsole"), "AgentConsole") },
                  {
                    path: "t/:conversationId",
                    lazy: page(() => import("@/features/agent/AgentConsole"), "AgentConsole"),
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
