// Vite config for the Anna App bundle build.
//
// The published appbuild must emit RELATIVE asset paths (./assets/...) because
// the bundle is served inside a sandboxed iframe on the Anna dashboard at an
// opaque origin — absolute "/assets/..." URLs would 404.
//
// This config is additive: the normal `npm run build` (which targets the
// standalone parent.family deployment) is untouched. Run this one with:
//   npm run build:anna
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: path.resolve(__dirname, '../../childcare-handoff/bundle'),
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      // Single entry — the Anna App is one view, so the router and the shell
      // are excluded from the graph rather than merely unused.
      input: path.resolve(__dirname, 'anna-main.jsx'),
      output: {
        entryFileNames: 'assets/anna-app.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
