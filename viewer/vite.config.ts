import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages 项目站点部署在 /antelope-i18n/ 子路径下，
  // 不设 base 会让所有资源引用变成根路径而 404。见 docs/viewer-spec.md §6
  base: '/antelope-i18n/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // xlsx 是动态 import 的独立 chunk，体积偏大属预期
    chunkSizeWarningLimit: 1200,
  },
});
