import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest,
      // Add these options for better TypeScript handling
      contentScripts: {
        injectCss: true
      }
    })
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        // Let CRXJS handle this automatically
      }
    }
  }
});