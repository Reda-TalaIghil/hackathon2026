import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Flowback',
      fileName: 'flowback',
      formats: ['iife', 'umd'],
    },
    minify: 'terser',
    sourcemap: true,
  },
  server: {
    port: 5173,
    cors: true,
  },
});
