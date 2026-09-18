import { enterDevPlugin } from "vite-plugin-enter-dev";
import { enterProdPlugin } from "vite-plugin-enter-dev";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [react(), tailwindcss(), ...enterProdPlugin(), ...enterDevPlugin({
    react: false
  })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      "/api": "http://localhost:8000"
    }
  }
});
