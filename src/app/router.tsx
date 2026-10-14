import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from "react-router-dom";
import { GuestOnly, RequireAuth } from "./guards";
import { FullScreenLoader, NotFoundPage, RouteErrorPage } from "./pages/status-pages";
import { AppShell } from "./shells/AppShell";

// Route frontend (KHÔNG phải endpoint backend): /app (full), /compact (WebView/iframe hẹp), /login, /signup.
// /support, /admin, /widget, /embed được thêm ở các phase tương ứng. Trang tách chunk (lazy) để màn chat tải nhanh.

const page =
  <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) =>
  async () => ({ Component: (await load())[name] as ComponentType });

const memberRoutes = (base: string): RouteObject[] => [
  { index: true, lazy: page(() => import("@/features/legacy/LegacyChatPage"), "LegacyChatPage") },
  {
    path: "settings",
    lazy: page(() => import("@/features/account/SettingsLayout"), "SettingsLayout"),
    children: [
      { path: "profile", lazy: page(() => import("@/features/account/ProfileSettings"), "ProfileSettings") },
      { path: "appearance", lazy: page(() => import("@/features/account/AppearanceSettings"), "AppearanceSettings") },
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
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
