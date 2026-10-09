import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages publica el proyecto en https://<usuario>.github.io/Raton/
  // Con "./" todas las rutas de assets son relativas: funciona en Pages
  // (cualquier subcarpeta), en `vite preview` y abriendo dist directamente.
  // Si prefieres rutas absolutas, cambia a: base: "/Raton/",
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
