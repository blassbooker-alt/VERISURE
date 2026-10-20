import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/]lucide-react[\\/]/.test(id)) return "lucide-icons";
          if (/node_modules[\\/]@supabase[\\/]/.test(id)) return "supabase";
        },
      },
    },
  },
});
