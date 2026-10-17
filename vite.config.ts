import { defineConfig } from 'vite';
export default defineConfig({
  root: 'web',
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0, outDir: '../dist', emptyOutDir: true },
  test: { root: '.', include: ['test/**/*.test.ts'] },
});
