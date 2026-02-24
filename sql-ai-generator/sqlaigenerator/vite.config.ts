import path from "path"

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    strictPort: false, // Se 5173 estiver em uso, tenta próxima porta
  },

  // Expor variáveis de ambiente
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL),
  },
})
