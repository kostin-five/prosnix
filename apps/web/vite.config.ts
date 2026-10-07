import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  // The public demo does not load local environment files or the Telegram SDK.
  ...(mode === "portfolio" ? { envDir: false, envPrefix: [], build: { outDir: "dist-demo" } } : {}),
  server: { port: 5190, strictPort: true },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "isolated-portfolio",
      transformIndexHtml(html) {
        return mode === "portfolio"
          ? html.replace(/<script src="https:\/\/telegram\.org[^>]*><\/script>/, "")
          : html;
      },
    },
  ],
  assetsInclude: ["**/*.svg", "**/*.csv"],
}));
