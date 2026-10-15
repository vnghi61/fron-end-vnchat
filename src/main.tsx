import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import { isolateSession, WIDGET_TOKEN_SCOPE } from "./core/api/transport";

// Widget khách: phiên riêng, không cookie (contract map B15) – phải chọn trước request đầu tiên.
if (window.location.pathname.startsWith("/widget")) isolateSession(WIDGET_TOKEN_SCOPE);

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
