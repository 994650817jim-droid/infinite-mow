import { defineConfig } from 'vite';

// Mobile-first portrait game. Exposes the dev server on the LAN so the game can
// be opened from a real phone during playtesting.
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    // OneDrive 目录下 fs.watch 会因原子写临时目录报 EBUSY，改用轮询监听。
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
