import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  preview: {
    proxy: { '/api': { target: process.env.API_INTERNAL_URL || 'http://127.0.0.1:8080', changeOrigin: true } },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.API_INTERNAL_URL || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
});
