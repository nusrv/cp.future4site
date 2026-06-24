import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "src/client",
  build: {
    outDir: "../../dist-client",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": "/src/client",
      "@shared": "/src/shared"
    }
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000"
    }
  }
});

