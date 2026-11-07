import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// The 3D view's webview: its own IIFE bundle, so three.js stays out of the
// sheet editor. Built after vite.config.mts, which empties media/dist.
export default defineConfig({
  plugins: [svelte()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "media/dist",
    emptyOutDir: false,
    chunkSizeWarningLimit: 1500,
    lib: { entry: "webview/view3d/main.ts", formats: ["iife"], name: "SepiaView3D", fileName: () => "view3d.js" },
    rollupOptions: { output: { assetFileNames: "view3d.[ext]" } },
  },
});
