import { mergeConfig, defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
      restoreMocks: true,
      // Máy dev chạy kèm Docker/Vite: giới hạn worker để fork không quá thời gian khởi động
      maxWorkers: 4,
    },
  }),
);
