import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import { EMBED_TOKEN_SCOPE, isolateSession, WIDGET_TOKEN_SCOPE } from "./core/api/transport";
import { inIframe } from "./core/embed/bridge";

// Chọn cách xác thực trước request đầu tiên:
// - /widget: phiên khách riêng, không cookie (contract map B15)
// - /embed hoặc đang nằm trong iframe: Bearer + token trong storage của iframe (cookie SameSite không đi ở ngữ cảnh bên thứ ba)
if (window.location.pathname.startsWith("/widget")) isolateSession(WIDGET_TOKEN_SCOPE);
else if (window.location.pathname.startsWith("/embed") || inIframe) isolateSession(EMBED_TOKEN_SCOPE);

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
