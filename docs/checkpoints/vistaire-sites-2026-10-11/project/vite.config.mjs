import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const source = (path) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      "@": source("./src/pages/source"),
      "next/link": source("./src/pages/NativeLink.tsx"),
      "next/image": source("./src/pages/NativeImage.tsx"),
      "next/navigation": source("./src/pages/NativeNavigation.ts"),
    },
  },
  build: {
    outDir: "dist/client",
    rollupOptions: { output: { manualChunks: { three: ["three"] } } },
  },
  optimizeDeps: { include: ["react", "react-dom/client"] },
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  plugins: [react()],
});
