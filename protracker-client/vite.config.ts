/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Split large third-party libraries into their own long-cacheable vendor chunks
    // so the main entry stays small and page chunks (React.lazy) load on demand.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react-router') || id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react-vendor';
          if (id.includes('/framer-motion/') || id.includes('/motion-dom/') || id.includes('/motion-utils/') || id.includes('/lucide-react/')) return 'ui-vendor';
          if (id.includes('/recharts') || id.includes('/d3-') || id.includes('/internmap/') || id.includes('/victory-vroom/') || id.includes('/decimal.js-light/') || id.includes('/fast-equals/')) return 'chart-vendor';
          if (id.includes('/@tanstack/')) return 'query-vendor';
          // Heavy PDF stack (@react-pdf + pdfkit/fontkit/…) is only reached via a dynamic
          // import on export — keep it in its own chunk so it never loads eagerly.
          if (id.match(/node_modules\/(@react-pdf|pdfkit|fontkit|@foliojs-fork|restructure|brotli|linebreak|png-js|unicode-|browserify-zlib|inflate|deflate|pako)/)) return 'pdf-vendor';
          // Everything else: let Rollup decide (so dynamic-only deps stay lazy).
        },
      },
    },
    // Raised to accommodate the pdf-vendor chunk (@react-pdf's PDF engine + embedded
    // fonts) which is large but loaded only on demand when a user exports a report.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
