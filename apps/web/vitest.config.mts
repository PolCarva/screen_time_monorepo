import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Route handlers import through the Next.js "@/" alias.
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
