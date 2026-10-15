// Máy chủ tĩnh cho trang host mẫu – chạy ở một SITE KHÁC VNChat để thử nhúng cross-site:
//   VNCHAT_ORIGIN=http://localhost:5174 node examples/host/serve.mjs   → http://127.0.0.1:5180
// (127.0.0.1 và localhost là hai site khác nhau với trình duyệt: cookie SameSite không đi, storage bị partition.)
// Nhớ thêm http://127.0.0.1:5180 vào VITE_EMBED_PARENT_ORIGINS của VNChat (vd. .env.development.local).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const origin = (process.env.VNCHAT_ORIGIN ?? "http://localhost:5174").replace(/\/+$/, "");
const port = Number(process.env.PORT ?? 5180);
const host = process.env.HOST ?? "127.0.0.1";

createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  const file = normalize(join(root, path === "/" ? "index.html" : path));
  if (!file.startsWith(root) || !file.endsWith(".html")) {
    res.writeHead(404).end("not found");
    return;
  }
  try {
    const html = (await readFile(file, "utf8")).replaceAll("%VNCHAT_ORIGIN%", origin);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, host, () => console.log(`host demo: http://${host}:${port}  (VNChat: ${origin})`));
