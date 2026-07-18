import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// path alias `@/` → src (프론트 CLAUDE.md [3])
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 개발 프록시 — API base 는 동일 오리진 `/api/v1`(.env.example)이므로 dev 서버가 백엔드로 넘긴다.
  // 운영은 게이트웨이가 같은 경로를 담당하므로 클라이언트 코드는 무변경이다.
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
