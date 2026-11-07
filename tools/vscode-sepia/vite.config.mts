import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// The sheet editor webview: one IIFE bundle in media/dist, loaded by
// src/sheetEditor.ts. It shares src/core with the extension and the CLI.
export default defineConfig({
  plugins: [svelte()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "media/dist",
    emptyOutDir: true,
    lib: { entry: "webview/main.ts", formats: ["iife"], name: "SepiaSheet", fileName: () => "sheet.js" },
    rollupOptions: { output: { assetFileNames: "sheet.[ext]" } },
  },
});
