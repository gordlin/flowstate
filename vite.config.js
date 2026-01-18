import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest,
      contentScripts: {
        injectCss: true,
      },
    }),
  ],
  build: {
    target: "es2020",
    rollupOptions: {
      input: {},
    },
  },
  resolve: {
    alias: {
      "node:async_hooks": "async_hooks",
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  define: {
    "process.env": {},
    global: "globalThis",
  },
});
