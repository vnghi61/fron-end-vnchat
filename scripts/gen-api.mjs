// Sinh kiểu TypeScript từ OpenAPI THẬT của backend (không tự viết schema).
// Nguồn: biến VNCHAT_OPENAPI (đường dẫn file hoặc URL /api-docs/openapi.yaml), mặc định repo backend cạnh repo này.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const source = process.env.VNCHAT_OPENAPI || resolve("..", "back-end-vnchat", "api", "openapi.yaml");
if (!/^https?:\/\//.test(source) && !existsSync(source)) {
  console.error(`Không thấy OpenAPI tại ${source}. Đặt VNCHAT_OPENAPI=<file hoặc URL>.`);
  process.exit(1);
}
const out = "src/core/api/generated/openapi.d.ts";
execFileSync(process.execPath, ["node_modules/openapi-typescript/bin/cli.js", source, "-o", out], { stdio: "inherit" });
console.log(`→ ${out} (nguồn: ${source})`);
