import { enterDevPlugin } from "vite-plugin-enter-dev";
import { enterProdPlugin } from "vite-plugin-enter-dev";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react(), ...enterProdPlugin(), ...enterDevPlugin({
    react: false
  })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
