import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// CSP frame-ancestors giống cấu hình deploy (deploy/README.md): chỉ /embed/* và /widget được nhúng bởi origin trong
// allowlist, mọi route khác chỉ 'self' (chống clickjacking). Áp cho cả dev và `vite preview` để kiểm thử nhúng cross-site.
function frameAncestors(origins: string[]): Plugin {
  const allowed = origins.filter((o) => /^https?:\/\/[^/\s*]+$/.test(o));
  const policy = (url: string) =>
    /^\/(embed|widget)(\/|\?|$)/.test(url) ? ["frame-ancestors 'self'", ...allowed].join(" ") : "frame-ancestors 'self'";
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    res.setHeader("Content-Security-Policy", policy(req.url ?? "/"));
    next();
  };
  return {
    name: "vnchat-frame-ancestors",
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

// Dev: chạy cổng 5174 (backend chỉ cho CORS http://localhost:5174 mặc định) và proxy /api + /socket.io tới backend
// để cookie jwt là first-party. Production: VITE_API_URL trỏ tới API (rỗng = cùng origin).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_DEV_API_TARGET || "http://localhost:5001";
  return {
    plugins: [
      react(),
      tailwindcss(),
      frameAncestors((env.VITE_EMBED_PARENT_ORIGINS ?? "").split(",").map((s) => s.trim())),
    ],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": { target, changeOrigin: true },
        "/socket.io": { target, changeOrigin: true, ws: true },
      },
    },
    preview: { port: 5174, strictPort: true },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          // Vendor ít đổi tách riêng để cache lâu giữa các lần deploy.
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return "react";
            if (/node_modules\/(socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser)\//.test(id))
              return "realtime";
            return undefined;
          },
        },
      },
    },
  };
});
