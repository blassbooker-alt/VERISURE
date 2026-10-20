import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function appShellPrecache() {
  return {
    name: "fortalfy-app-shell-precache",
    generateBundle(_, bundle) {
      const appFiles = Object.values(bundle)
        .map(output => output.fileName)
        .filter(file => file === "index.html" || /^assets\/.*\.(?:js|css)$/.test(file))
        .map(file => `./${file}`);
      this.emitFile({
        type: "asset",
        fileName: "precache-manifest.json",
        source: JSON.stringify(["./", "./manifest.webmanifest", ...appFiles]),
      });
    },
  };
}

export default defineConfig({
  base: "./",
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react(), tailwindcss(), appShellPrecache()],
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
