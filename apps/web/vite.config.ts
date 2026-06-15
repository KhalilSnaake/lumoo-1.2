import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // L'app a été déplacée dans apps/web ; on garde le chargement du .env depuis
  // la racine du monorepo (emplacement historique des variables VITE_*).
  envDir: path.resolve(__dirname, "../.."),
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@lumoo/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
});
