// Kiểm tra bản build (dist/) trước khi phát hành – chạy sau `vite build` (npm run check):
//  1. Ngân sách kích thước (gzip): JS tải ban đầu (entry + modulepreload trong index.html), chunk lớn nhất, loader widget.
//  2. Không có bí mật trong JS/HTML/CSS công khai: private key, JWT, API key ck_, chuỗi kết nối DB, mật khẩu QA.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = "dist";
// Mức đo ở Phase 7: initial 248.8 KB, chunk lớn nhất 152.6 KB, loader 3.0 KB – ngân sách = mức đo + ~8% để chặn phình ra.
const BUDGET_KB = { initialJs: 270, largestChunk: 165, widgetLoader: 4 };

if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/index.html không có – chạy `vite build` trước");
  process.exit(1);
}

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
const gz = (path) => gzipSync(readFileSync(path)).length / 1024;
const failures = [];

// 1. Kích thước
const html = readFileSync(join(DIST, "index.html"), "utf8");
const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => join(DIST, m[1]));
const initialKb = initial.reduce((sum, f) => sum + gz(f), 0);
const chunks = files(join(DIST, "assets")).filter((f) => f.endsWith(".js"));
const largest = chunks.map((f) => ({ f, kb: gz(f) })).sort((a, b) => b.kb - a.kb)[0];
const loaderKb = gz(join(DIST, "vnchat-widget.js"));
const report = [
  ["initial JS (gzip)", initialKb, BUDGET_KB.initialJs],
  [`largest chunk ${largest.f.replace(/\\/g, "/")}`, largest.kb, BUDGET_KB.largestChunk],
  ["vnchat-widget.js (gzip)", loaderKb, BUDGET_KB.widgetLoader],
];
for (const [label, kb, budget] of report) {
  const ok = kb <= budget;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${kb.toFixed(1)} KB / ${budget} KB`);
  if (!ok) failures.push(`${label} vượt ngân sách`);
}

// 2. Bí mật
const qaPassword = existsSync(".env.e2e")
  ? readFileSync(".env.e2e", "utf8")
      .match(/^QA_PASSWORD=(.+)$/m)?.[1]
      ?.trim()
  : undefined;
const patterns = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["JWT", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["VNChat API key", /\bck_[A-Za-z0-9]{20,}/],
  ["DB connection string with credentials", /mongodb(\+srv)?:\/\/[^\s"'`/]+:[^\s"'`@]+@/],
  ["AWS key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Cloudinary secret", /CLOUDINARY_API_SECRET|api_secret\s*[:=]\s*["'][A-Za-z0-9_-]{10,}/],
];
for (const file of files(DIST).filter((f) => /\.(js|html|css)$/.test(f))) {
  const text = readFileSync(file, "utf8");
  for (const [label, re] of patterns) if (re.test(text)) failures.push(`${label} trong ${file}`);
  if (qaPassword && qaPassword.length >= 6 && text.includes(qaPassword)) failures.push(`mật khẩu QA trong ${file}`);
}
console.log(
  failures.some((f) => !f.includes("ngân sách")) ? "✗ secret scan" : "✓ secret scan: không có bí mật trong dist",
);

if (failures.length) {
  console.error(`\n${failures.join("\n")}`);
  process.exit(1);
}
