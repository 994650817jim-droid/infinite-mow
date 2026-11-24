import { defineConfig } from 'vite';
import { relative, sep } from 'node:path';

// 项目根下不属于网页源码的目录：其他会话的工作树（.claude）、构建与打包产物、原始美术、截图。
// 轮询监听会逐个 stat 这些文件（主工作区约 1.5 万个），dev server 空转也吃满 CPU；改动它们也不该触发页面刷新。
const UNWATCHED = ['.claude', '.build-tmp', 'dist', 'release', 'assets', 'screenshots', 'docs', 'obstacle_original_assets_for_review'];
const root = process.cwd();
const unwatched = (path: string): boolean => {
  const rel = relative(root, path);
  return UNWATCHED.some(dir => rel === dir || rel.startsWith(dir + sep));
};

// Mobile-first portrait game. Exposes the dev server on the LAN so the game can
// be opened from a real phone during playtesting.
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/coop-socket': { target: 'ws://127.0.0.1:' + (process.env.COOP_PORT ?? '8787'), ws: true } },
    // OneDrive 目录下 fs.watch 会因原子写临时目录报 EBUSY，改用轮询监听。
    watch: {
      usePolling: true,
      interval: 300,
      ignored: unwatched,
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: id => /node_modules[\\/]phaser[\\/]/.test(id) ? 'phaser' : undefined } },
  },
});
