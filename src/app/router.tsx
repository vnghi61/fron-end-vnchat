import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { FrameGuard, GuestOnly, RequireAuth, RequirePermission } from "./guards";
import { FullScreenLoader, NotFoundPage, RouteErrorPage } from "./pages/status-pages";
import { AdminShell } from "./shells/AdminShell";
import { AgentShell } from "./shells/AgentShell";
import { EmbedRoot } from "./shells/EmbedRoot";
import { AppShell } from "./shells/AppShell";

// Route frontend (KHÔNG phải endpoint backend): /app (full), /compact (WebView/iframe hẹp), /login, /signup.
// /support (console hỗ trợ), /admin (quản trị), /widget (khách), /embed (iframe đối tác). Trang tách chunk (lazy) để màn chat tải nhanh.

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
    element: <FrameGuard />,
    errorElement: <RouteErrorPage />,
    HydrateFallback: FullScreenLoader,
    children: [
      { path: "/", element: <Navigate to="/app" replace /> },
      // App nhúng iframe (màn 25): đăng nhập ngay trong khung (Bearer, transport cách ly – main.tsx)
      {
        path: "/embed",
        element: <EmbedRoot />,
        children: [
          {
            element: <GuestOnly />,
            children: [
              { path: "login", lazy: page(() => import("@/features/auth/LoginPage"), "LoginPage") },
              { path: "signup", lazy: page(() => import("@/features/auth/SignupPage"), "SignupPage") },
            ],
          },
          {
            element: <RequireAuth />,
            children: [{ element: <AppShell variant="embed" base="/embed" />, children: memberRoutes("/embed") }],
          },
        ],
      },
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
          {
            path: "/admin",
            element: <RequirePermission permission="admin" />,
            children: [
              {
                element: <AdminShell />,
                children: [
                  { index: true, element: <Navigate to="users" replace /> },
                  { path: "users", lazy: page(() => import("@/features/admin/UsersSection"), "UsersSection") },
                  { path: "policies", lazy: page(() => import("@/features/admin/PoliciesSection"), "PoliciesSection") },
                  { path: "settings", lazy: page(() => import("@/features/admin/SettingsSection"), "SettingsSection") },
                  { path: "webhooks", lazy: page(() => import("@/features/admin/WebhooksSection"), "WebhooksSection") },
                  { path: "api-keys", lazy: page(() => import("@/features/admin/ApiKeysSection"), "ApiKeysSection") },
                  { path: "audit", lazy: page(() => import("@/features/admin/AuditSection"), "AuditSection") },
                  { path: "*", element: <Navigate to="/admin/users" replace /> },
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
