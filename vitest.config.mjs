import { defineConfig } from "vitest/config"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(rootDir, "test/stubs/server-only.ts"),
      "@": path.resolve(rootDir),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
})
