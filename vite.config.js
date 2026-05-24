import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/react-router/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (
            id.includes('/date-fns/') ||
            id.includes('/crypto-js/') ||
            id.includes('/dompurify/')
          ) {
            return 'vendor-utils';
          }
          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, './src'),
    },
  },
});
