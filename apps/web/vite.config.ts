import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) return "online";
            // Only React itself: three.js helpers with "react" in their name
            // must stay in the lazily loaded 3D chunk.
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id))
              return "react";
            if (id.includes("zod")) return "validation";
          }
        },
      },
    },
  },
  server: { host: "127.0.0.1" },
});
